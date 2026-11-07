// Geração de um nível de estudo: planejar → buscar → triar → conferir → ler → escrever → verificar → mapa/gráficos → perguntas.
import type { SupabaseClient } from "@supabase/supabase-js";
import { NIVEIS, basemapMaisProximo, periodoPorId, fmtAno } from "./periodos";
import { buscarObras, enriquecerCrossref, producaoPorDecada, type Candidato } from "./openalex";
import { obterTextoCompleto } from "./textoCompleto";
import { referenciaTexto } from "./abnt";
import { melhoresTrechos, normalizar, numeroNoTrecho, termos, trechoConfere } from "./texto";
import { geocodificarLista } from "./geo";
import { gerarJSON, MODELO_RAPIDO, obj, str, int, num, arr, nullable } from "./ia";

export type Estudo = { id: string; titulo: string; tema: string; divisao: string; periodo: string | null; inicio: number | null; fim: number | null };
export type FonteDB = Candidato & { id: string; abnt: string; texto_completo: string | null; nivel: number | null };

const REGRAS_FONTES = `REGRAS INEGOCIÁVEIS:
- Use SOMENTE as informações presentes no material das fontes [S#] fornecido. Não use conhecimento próprio para acrescentar fatos, datas, números, nomes ou interpretações que não estejam no material.
- Toda afirmação factual deve terminar com o marcador da(s) fonte(s) que a sustentam, ex.: "... no século XVI [S3]." ou "[S2][S5]".
- Nunca escreva nomes de autores com ano entre parênteses; use apenas os marcadores [S#]. O sistema converte para ABNT.
- Se o material não cobre um aspecto, diga explicitamente que as fontes consultadas não tratam dele, em vez de preencher a lacuna.
- Citações diretas: só copie trechos que estejam LITERALMENTE no material da fonte (o sistema confere letra por letra e descarta o que não bater).`;

async function etapa(sb: SupabaseClient, levelId: string, texto: string) {
  await sb.from("levels").update({ etapa: texto }).eq("id", levelId);
}

function rotuloPeriodo(e: Estudo) {
  const p = periodoPorId(e.periodo);
  if (p) return `${p.nome} (${p.rotulo}) — divisão ${p.divisao === "brasil" ? "História do Brasil" : "História Geral"}`;
  if (e.inicio != null && e.fim != null) return `${fmtAno(e.inicio)}–${fmtAno(e.fim)}`;
  return "recorte livre";
}

/** Monta o bloco de material para a IA com orçamento de caracteres. */
export function materialDasFontes(fs: FonteDB[], consulta: string, orcamento = 95_000) {
  const rotulos: Record<string, string> = {};
  const porRotulo: Record<string, FonteDB> = {};
  const blocos: string[] = [];
  const porFonte = Math.max(3000, Math.floor(orcamento / Math.max(1, fs.length)));
  fs.forEach((f, i) => {
    const r = `S${i + 1}`;
    rotulos[f.id] = r;
    porRotulo[r] = f;
    let b = `[${r}] ${referenciaTexto({ ...f })}\nTipo: ${f.tipo}. Idioma: ${f.idioma || "?"}.\nRESUMO: ${f.resumo || "(sem resumo)"}`;
    if (f.texto_completo) {
      const tr = melhoresTrechos(f.texto_completo, consulta, 6, 1100);
      let acc = "";
      for (const t of tr) if ((b + acc + t).length < porFonte) acc += `\n— TRECHO DO TEXTO COMPLETO: ${t}`;
      b += acc;
    }
    blocos.push(b.slice(0, porFonte));
  });
  return { texto: blocos.join("\n\n"), rotulos, porRotulo };
}

const textoVerificavel = (f: FonteDB) => `${f.titulo}\n${f.resumo || ""}\n${f.texto_completo || ""}`;

type Plano = { buscas: string[]; secoes: string[]; ano_referencia_mapa: number | null };
type Triagem = { selecionadas: { indice: number; motivo: string }[] };
type Paragrafo = { texto: string; fontes: string[]; citacao_direta: { fonte: string; trecho: string } | null };
type Escrita = {
  titulo: string;
  abertura: string;
  secoes: { titulo: string; paragrafos: Paragrafo[] }[];
  conceitos: { termo: string; definicao: string; fontes: string[] }[];
  cronologia: { ano: number; evento: string; fonte: string }[];
  lugares: { nome_no_periodo: string; nome_atual: string; pais_atual: string; papel: string; fonte: string }[];
  dados_numericos: { titulo: string; unidade: string; serie: { rotulo: string; valor: number }[]; fonte: string; trecho_literal: string }[];
};
type Perguntas = {
  multipla: { enunciado: string; opcoes: string[]; correta: number; explicacao: string; fontes: string[] }[];
  abertas: { enunciado: string; resposta_esperada: string; fontes: string[] }[];
};

export async function gerarNivel(sb: SupabaseClient, estudo: Estudo, n: number, levelId: string, userId: string) {
  const nivel = NIVEIS[n - 1];
  const periodo = rotuloPeriodo(estudo);

  // Níveis anteriores (para não repetir e para progredir em complexidade)
  const { data: anteriores } = await sb.from("levels").select("n,titulo,conteudo").eq("study_id", estudo.id).lt("n", n).eq("status", "pronto").order("n");
  const resumoAnteriores = (anteriores || [])
    .map((l: any) => `Nível ${l.n} — ${l.titulo}: ${(l.conteudo?.secoes || []).map((s: any) => s.titulo).join("; ")}`)
    .join("\n");

  // 1. Planejar
  await etapa(sb, levelId, "Planejando as buscas e as seções do nível");
  const plano = await gerarJSON<Plano>({
    modelo: MODELO_RAPIDO(),
    nome: "plano",
    sistema: "Você é um professor de História que planeja estudos acadêmicos de graduação no Brasil.",
    usuario: `Tema do estudo: ${estudo.tema}\nPeríodo: ${periodo}\nNível ${n} de 5: ${nivel.nome} — ${nivel.foco}\n${resumoAnteriores ? `Já estudado nos níveis anteriores:\n${resumoAnteriores}\n` : ""}
Planeje:
1) "buscas": 6 consultas curtas (2 a 6 palavras) para encontrar artigos acadêmicos na OpenAlex sobre este nível do tema. Misture português (pelo menos 3), inglês e espanhol. Use termos que historiadores usariam em títulos e resumos.
2) "secoes": 5 a 7 títulos de seções para um texto de 3 a 4 páginas neste nível, sem repetir o que já foi estudado.
3) "ano_referencia_mapa": um ano representativo para mostrar fronteiras de época no mapa (negativo para a.C.), ou null se o tema não tiver espaço geográfico definido.`,
    schema: obj({ buscas: arr(str), secoes: arr(str), ano_referencia_mapa: nullable(int) }),
    maxTokens: 800,
  });

  // 2. Buscar
  await etapa(sb, levelId, "Buscando artigos, livros e capítulos na OpenAlex");
  const lotes = await Promise.allSettled(plano.buscas.slice(0, 7).map((q) => buscarObras(q, 15)));
  const vistos = new Map<string, Candidato>();
  for (const l of lotes) if (l.status === "fulfilled") for (const c of l.value) if (!vistos.has(c.openalex_id) && (c.resumo?.length || 0) > 200) vistos.set(c.openalex_id, c);
  const { data: jaNoEstudo } = await sb.from("sources").select("*").eq("study_id", estudo.id);
  const idsExistentes = new Set((jaNoEstudo || []).map((s: any) => s.openalex_id));
  const candidatos = [...vistos.values()].filter((c) => !idsExistentes.has(c.openalex_id)).slice(0, 70);
  if (!candidatos.length && !(jaNoEstudo || []).length) throw new Error("Nenhuma fonte acadêmica encontrada na OpenAlex para este tema. Reformule o tema com termos mais usuais.");

  // 3. Triar relevância
  await etapa(sb, levelId, `Selecionando as fontes mais relevantes entre ${candidatos.length} encontradas`);
  let escolhidos: Candidato[] = [];
  if (candidatos.length) {
    const lista = candidatos
      .map((c, i) => `[${i}] ${c.titulo} (${c.ano ?? "s.d."}; ${c.tipo}; ${c.revista || c.editora || "?"}; ${c.citacoes} citações)\n${(c.resumo || "").slice(0, 450)}`)
      .join("\n\n");
    const tri = await gerarJSON<Triagem>({
      modelo: MODELO_RAPIDO(),
      nome: "triagem",
      sistema: "Você seleciona bibliografia acadêmica de História com rigor. Descarte trabalhos fora do tema, de outras áreas sem relação histórica, resenhas muito curtas e textos sem conteúdo histórico substantivo.",
      usuario: `Tema: ${estudo.tema}\nPeríodo: ${periodo}\nNível ${n}: ${nivel.nome} — ${nivel.foco}\nSeções planejadas: ${plano.secoes.join("; ")}\n\nEscolha de 8 a 12 trabalhos que melhor sustentam este nível (prefira relevância direta, depois diversidade de abordagens). Se houver poucos relevantes, escolha menos. Devolva os índices.\n\n${lista}`,
      schema: obj({ selecionadas: arr(obj({ indice: int, motivo: str })) }),
      maxTokens: 1500,
    });
    escolhidos = tri.selecionadas.map((s) => candidatos[s.indice]).filter(Boolean).slice(0, 12);
  }

  // 4. Conferir metadados
  await etapa(sb, levelId, "Conferindo metadados pelo DOI na Crossref");
  escolhidos = await Promise.all(escolhidos.map(enriquecerCrossref));

  // 5. Ler textos completos em acesso aberto
  await etapa(sb, levelId, "Lendo os textos completos disponíveis em acesso aberto");
  const textos = await Promise.all(escolhidos.map((c) => obterTextoCompleto(c.url_oa)));

  // 6. Salvar fontes novas
  if (escolhidos.length) {
    const linhas = escolhidos.map((c, i) => ({
      study_id: estudo.id,
      user_id: userId,
      openalex_id: c.openalex_id,
      doi: c.doi,
      tipo: c.tipo,
      titulo: c.titulo,
      autores: c.autores,
      ano: c.ano,
      revista: c.revista,
      editora: c.editora,
      local: c.local,
      volume: c.volume,
      numero: c.numero,
      paginas: c.paginas,
      idioma: c.idioma,
      citacoes: c.citacoes,
      resumo: c.resumo,
      texto_completo: textos[i],
      url: c.url,
      url_oa: c.url_oa,
      abnt: referenciaTexto({ id: c.openalex_id, ...c }),
      nivel: n,
    }));
    const { error } = await sb.from("sources").upsert(linhas, { onConflict: "study_id,openalex_id" });
    if (error) throw new Error("Erro ao salvar fontes: " + error.message);
  }

  // Fontes usadas na escrita: as novas + até 5 anteriores mais relacionadas
  const { data: todas } = await sb.from("sources").select("*").eq("study_id", estudo.id);
  const novas = (todas || []).filter((s: any) => s.nivel === n) as FonteDB[];
  const consulta = `${estudo.tema} ${plano.secoes.join(" ")}`;
  const qt = new Set(termos(consulta));
  const antigas = (todas || [])
    .filter((s: any) => s.nivel !== n)
    .map((s: any) => ({ s, score: termos(`${s.titulo} ${s.resumo || ""}`).filter((t) => qt.has(t)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.s as FonteDB);
  const usadas = [...novas, ...antigas];
  if (!usadas.length) throw new Error("Não há fontes suficientes para escrever este nível.");
  const mat = materialDasFontes(usadas, consulta);

  // 7. Escrever
  await etapa(sb, levelId, `Escrevendo o texto do nível a partir de ${usadas.length} fontes`);
  const escrita = await gerarJSON<Escrita>({
    nome: "nivel",
    maxTokens: 12000,
    temperatura: 0.4,
    sistema: `Você é um historiador e professor universitário brasileiro escrevendo material de estudo para graduação em História, em português do Brasil, com rigor acadêmico e clareza.\n${REGRAS_FONTES}`,
    usuario: `TEMA: ${estudo.tema}\nPERÍODO: ${periodo}\nNÍVEL ${n} DE 5 — ${nivel.nome}: ${nivel.foco}\n${resumoAnteriores ? `NÍVEIS JÁ ESTUDADOS (não repita, aprofunde):\n${resumoAnteriores}\n` : ""}SEÇÕES SUGERIDAS: ${plano.secoes.join(" | ")} (ajuste conforme o que as fontes realmente sustentam)

TAREFA: escreva o texto deste nível com 1.600 a 2.100 palavras (3 a 4 páginas), em 5 a 7 seções, com parágrafos densos (4 a 7 frases). A complexidade deve corresponder ao nível ${n} (nível 1 introdutório; nível 5 de pesquisa). Em "fontes" de cada parágrafo liste os rótulos usados no texto. Use "citacao_direta" em no máximo 4 parágrafos, só com trechos literais curtos (até 40 palavras) do material.
Também extraia, SOMENTE do material:
- "conceitos": 4 a 8 conceitos-chave com definição baseada nas fontes;
- "cronologia": eventos com ano explícito no material (o número do ano precisa aparecer no texto da fonte indicada);
- "lugares": lugares geográficos citados no material (nome no período, nome atual da cidade/região, país atual, papel no tema);
- "dados_numericos": apenas séries numéricas que aparecem literalmente em um trecho do material (copie o trecho em "trecho_literal"); se não houver, devolva lista vazia.
"abertura": 2 a 3 frases apresentando o nível, sem marcadores.

MATERIAL DAS FONTES:
${mat.texto}`,
    schema: obj({
      titulo: str,
      abertura: str,
      secoes: arr(obj({ titulo: str, paragrafos: arr(obj({ texto: str, fontes: arr(str), citacao_direta: { anyOf: [obj({ fonte: str, trecho: str }), { type: "null" }] } })) })),
      conceitos: arr(obj({ termo: str, definicao: str, fontes: arr(str) })),
      cronologia: arr(obj({ ano: int, evento: str, fonte: str })),
      lugares: arr(obj({ nome_no_periodo: str, nome_atual: str, pais_atual: str, papel: str, fonte: str })),
      dados_numericos: arr(obj({ titulo: str, unidade: str, serie: arr(obj({ rotulo: str, valor: num })), fonte: str, trecho_literal: str })),
    }),
  });

  // 8. Verificar tudo contra as fontes
  await etapa(sb, levelId, "Conferindo citações, datas e lugares contra o texto das fontes");
  const avisos: string[] = [];
  const idDe = (r: string) => mat.porRotulo[r.replace(/[\[\]\s]/g, "")]?.id;
  let removidos = 0, citDescartadas = 0, palavras = 0;
  const secoes = escrita.secoes
    .map((s) => ({
      titulo: s.titulo,
      paragrafos: s.paragrafos
        .map((p) => {
          // marcadores no texto
          const noTexto = [...p.texto.matchAll(/\[(S\d+)\]/g)].map((m) => m[1]);
          const validos = [...new Set([...noTexto, ...p.fontes])].filter((r) => idDe(r));
          const texto = p.texto.replace(/\[(S\d+)\]/g, (m, r) => (idDe(r) ? `[[${idDe(r)}]]` : ""));
          if (!validos.length) { removidos++; return null; }
          let citacao: { fonte: string; trecho: string } | null = null;
          if (p.citacao_direta) {
            const f = mat.porRotulo[p.citacao_direta.fonte.replace(/[\[\]\s]/g, "")];
            if (f && trechoConfere(p.citacao_direta.trecho, textoVerificavel(f))) citacao = { fonte: f.id, trecho: p.citacao_direta.trecho.trim() };
            else citDescartadas++;
          }
          palavras += texto.split(/\s+/).length;
          return { texto, fontes: validos.map((r) => idDe(r)!), citacao };
        })
        .filter(Boolean),
    }))
    .filter((s) => s.paragrafos.length);
  if (removidos) avisos.push(`${removidos} parágrafo(s) foram removidos por não indicarem fonte.`);
  if (citDescartadas) avisos.push(`${citDescartadas} citação(ões) direta(s) foram descartadas porque o trecho não confere com o texto da fonte.`);
  if (palavras < 1300) avisos.push(`O texto ficou com cerca de ${palavras} palavras: as fontes encontradas não sustentaram um texto mais longo.`);
  if (!secoes.length) throw new Error("A IA não produziu texto verificável a partir das fontes. Tente gerar de novo.");

  const conceitos = escrita.conceitos
    .map((c) => ({ termo: c.termo, definicao: c.definicao, fontes: c.fontes.map(idDe).filter(Boolean) as string[] }))
    .filter((c) => c.fontes.length);

  const cronologia = escrita.cronologia
    .filter((e) => {
      const f = mat.porRotulo[e.fonte.replace(/[\[\]\s]/g, "")];
      if (!f) return false;
      const t = normalizar(textoVerificavel(f));
      return new RegExp(`\\b${Math.abs(e.ano)}\\b`).test(t);
    })
    .map((e) => ({ ano: e.ano, evento: e.evento, fonte: idDe(e.fonte)! }))
    .sort((a, b) => a.ano - b.ano);
  const descCron = escrita.cronologia.length - cronologia.length;
  if (descCron > 0) avisos.push(`${descCron} evento(s) da cronologia foram descartados porque o ano não aparece no texto da fonte indicada.`);

  const lugaresOk = escrita.lugares
    .filter((l) => {
      const f = mat.porRotulo[l.fonte.replace(/[\[\]\s]/g, "")];
      if (!f) return false;
      const t = normalizar(textoVerificavel(f));
      return t.includes(normalizar(l.nome_no_periodo)) || t.includes(normalizar(l.nome_atual));
    })
    .slice(0, 14);

  const dados = escrita.dados_numericos
    .filter((d) => {
      const f = mat.porRotulo[d.fonte.replace(/[\[\]\s]/g, "")];
      return f && d.serie.length >= 2 && trechoConfere(d.trecho_literal, textoVerificavel(f)) && d.serie.every((s) => numeroNoTrecho(s.valor, d.trecho_literal));
    })
    .map((d) => ({ ...d, fonte: idDe(d.fonte)! }));

  // 9. Mapa
  await etapa(sb, levelId, "Localizando os lugares no mapa atual");
  const geo = await geocodificarLista(lugaresOk.map((l) => ({ ...l, pais_atual: l.pais_atual })));
  const lugares = geo
    .filter((g) => g.geo)
    .map((g) => ({ nome_no_periodo: g.nome_no_periodo, nome_atual: g.nome_atual, pais_atual: g.pais_atual, papel: g.papel, fonte: idDe(g.fonte)!, lat: g.geo!.lat, lon: g.geo!.lon }));
  const anoMapa = plano.ano_referencia_mapa ?? (estudo.inicio != null && estudo.fim != null ? Math.round((estudo.inicio + Math.min(estudo.fim, 2000)) / 2) : null);
  const mapa = { basemap: basemapMaisProximo(anoMapa), ano: anoMapa, lugares };

  // 10. Gráficos com dados reais
  await etapa(sb, levelId, "Montando os gráficos");
  let producao = null;
  try { producao = await producaoPorDecada(plano.buscas[0] || estudo.tema); } catch { /* opcional */ }
  const porAno: Record<number, number> = {};
  for (const f of novas) if (f.ano) porAno[Math.floor(f.ano / 10) * 10] = (porAno[Math.floor(f.ano / 10) * 10] || 0) + 1;
  const graficos = {
    producao,
    fontesPorDecada: Object.entries(porAno).map(([d, t]) => ({ decada: +d, total: t })).sort((a, b) => a.decada - b.decada),
    dados,
  };

  // 11. Perguntas de revisão
  await etapa(sb, levelId, "Criando perguntas de revisão");
  const textoFinal = secoes
    .map((s) => `## ${s.titulo}\n` + s.paragrafos.map((p: any) => p.texto.replace(/\[\[([0-9a-f-]+)\]\]/g, (_: string, id: string) => `[${mat.rotulos[id]}]`)).join("\n"))
    .join("\n\n");
  const perg = await gerarJSON<Perguntas>({
    modelo: MODELO_RAPIDO(),
    nome: "perguntas",
    sistema: "Você elabora avaliações de História para graduação. As perguntas devem exigir compreensão e relação entre ideias, com base exclusiva no texto fornecido.",
    usuario: `Crie 5 perguntas de múltipla escolha (4 alternativas, uma correta, distratores plausíveis; "correta" é o índice 0-3) e 2 perguntas abertas dissertativas com a resposta esperada (5 a 8 linhas) baseadas SOMENTE neste texto. Em "fontes" indique os rótulos [S#] que sustentam a resposta.\n\n${textoFinal}`,
    schema: obj({
      multipla: arr(obj({ enunciado: str, opcoes: arr(str), correta: int, explicacao: str, fontes: arr(str) })),
      abertas: arr(obj({ enunciado: str, resposta_esperada: str, fontes: arr(str) })),
    }),
    maxTokens: 3500,
  });
  await sb.from("questions").delete().eq("level_id", levelId);
  const qs = [
    ...perg.multipla.filter((q) => q.opcoes.length >= 2 && q.correta >= 0 && q.correta < q.opcoes.length).map((q, i) => ({
      level_id: levelId, study_id: estudo.id, user_id: userId, ordem: i + 1, tipo: "multipla", enunciado: q.enunciado,
      opcoes: q.opcoes, gabarito: String(q.correta), explicacao: q.explicacao, fontes: q.fontes.map(idDe).filter(Boolean),
    })),
    ...perg.abertas.map((q, i) => ({
      level_id: levelId, study_id: estudo.id, user_id: userId, ordem: 10 + i, tipo: "aberta", enunciado: q.enunciado,
      opcoes: null, gabarito: q.resposta_esperada, explicacao: null, fontes: q.fontes.map(idDe).filter(Boolean),
    })),
  ];
  if (qs.length) await sb.from("questions").insert(qs);

  // 12. Concluir
  const conteudo = {
    titulo: escrita.titulo,
    abertura: escrita.abertura,
    secoes,
    conceitos,
    avisos,
    palavras,
    fontes_usadas: usadas.map((f) => f.id),
    buscas: plano.buscas,
    modelo: process.env.OPENAI_MODEL || "gpt-4.1",
  };
  const { error } = await sb
    .from("levels")
    .update({ status: "pronto", etapa: null, erro: null, titulo: escrita.titulo, conteudo, mapa, graficos, cronologia, gerado_em: new Date().toISOString() })
    .eq("id", levelId);
  if (error) throw new Error(error.message);
}
