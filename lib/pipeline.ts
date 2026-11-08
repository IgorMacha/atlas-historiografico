// Geração de um nível de estudo: planejar → buscar → triar → conferir → ler → escrever → verificar → mapa/gráficos → perguntas.
import type { SupabaseClient } from "@supabase/supabase-js";
import { NIVEIS, basemapMaisProximo, periodoPorId, fmtAno } from "./periodos";
import { buscarObras, enriquecerCrossref, producaoPorDecada, type Candidato } from "./openalex";
import { obterTextoCompleto } from "./textoCompleto";
import { referenciaTexto } from "./abnt";
import { melhoresTrechos, normalizar, numeroNoTrecho, termos, trechoConfere } from "./texto";
import { geocodificarLista } from "./geo";
import { gerarJSON, MODELO_RAPIDO, obj, str, int, num, arr } from "./ia";
import { buscarSemanticScholar, buscarCore, buscarBdtd, buscarInternetArchive } from "./bases/outras";
import { gerarPlanoDeEnsino, type PlanoEnsino } from "./plano";

export type Estudo = { id: string; titulo: string; tema: string; divisao: string; periodo: string | null; inicio: number | null; fim: number | null; plano?: any };
export type FonteDB = Candidato & { id: string; abnt: string; texto_completo: string | null; nivel: number | null };

const REGRAS_FONTES = `REGRAS INEGOCIÁVEIS:
- O texto combina dois tipos de parágrafo:
  (a) "fonte": parágrafos com fatos, datas, números, nomes, processos e interpretações tirados do material das fontes [S#]. Toda afirmação desse tipo termina com o marcador da(s) fonte(s), ex.: "... no século XVI [S3]." ou "[S2][S5]".
  (b) "explicacao": parágrafos didáticos escritos por você para ligar as ideias, contextualizar, explicar conceitos com outras palavras, comparar o que as fontes dizem e conduzir o raciocínio do aluno. Eles NÃO podem trazer fatos novos: nada de datas, números, nomes próprios, eventos ou citações que não estejam no material.
- Nunca escreva nomes de autores com ano entre parênteses; use apenas os marcadores [S#]. O sistema converte para ABNT.
- Se o material não cobre um aspecto, diga explicitamente que as fontes consultadas não tratam dele.
- Citações diretas: só copie trechos que estejam LITERALMENTE no material da fonte (o sistema confere letra por letra e descarta o que não bater).
`;

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

type Paragrafo = { tipo: "fonte" | "explicacao"; texto: string; fontes: string[]; citacao_direta: { fonte: string; trecho: string } | null };
type Escrita = {
  titulo: string;
  abertura: string;
  secoes: { titulo: string; paragrafos: Paragrafo[] }[];
  conceitos: { termo: string; definicao: string; fontes: string[] }[];
  cronologia: { ano: number; evento: string; fonte: string }[];
  lugares: { nome_no_periodo: string; nome_atual: string; pais_atual: string; papel: string; fonte: string; secao: number }[];
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

  // 1. Plano de ensino (gerado uma vez por estudo)
  await etapa(sb, levelId, "Consultando o plano de ensino do estudo");
  const planoEnsino: PlanoEnsino = estudo.plano?.niveis?.length ? estudo.plano : await gerarPlanoDeEnsino(sb, estudo);
  const nivelPlano = planoEnsino.niveis[n - 1];
  const secoesPlano = nivelPlano.secoes;
  const plano = {
    buscas: secoesPlano.flatMap((s) => s.buscas),
    secoes: secoesPlano.map((s) => s.titulo),
    ano_referencia_mapa: nivelPlano.ano_referencia_mapa,
  };

  // 2. Buscar em todas as bases, seção por seção
  await etapa(sb, levelId, "Buscando fontes em OpenAlex, Semantic Scholar, CORE, BDTD e Internet Archive");
  const tarefas: { secao: number; p: Promise<Candidato[]> }[] = [];
  secoesPlano.forEach((sec, i) => {
    sec.buscas.slice(0, 3).forEach((q) => tarefas.push({ secao: i + 1, p: buscarObras(q, 10) }));
    const q0 = sec.buscas[0] || sec.titulo, q1 = sec.buscas[1] || q0;
    tarefas.push({ secao: i + 1, p: buscarSemanticScholar(q1, 8) });
    tarefas.push({ secao: i + 1, p: buscarCore(q1, 6) });
    tarefas.push({ secao: i + 1, p: buscarBdtd(q0, 6) });
    tarefas.push({ secao: i + 1, p: buscarInternetArchive(q1, 4) });
  });
  const lotes = await Promise.allSettled(tarefas.map((t) => t.p));
  const chave = (c: Candidato) => (c.doi ? "doi:" + c.doi.toLowerCase() : "t:" + normalizar(c.titulo).slice(0, 90));
  const vistos = new Map<string, Candidato>();
  lotes.forEach((l, k) => {
    if (l.status !== "fulfilled") return;
    for (const c of l.value) {
      if ((c.resumo?.length || 0) < 200) continue;
      const ch = chave(c);
      const ex = vistos.get(ch);
      if (ex) { ex.secoes = [...new Set([...(ex.secoes || []), tarefas[k].secao])]; if (!ex.texto_previo && c.texto_previo) ex.texto_previo = c.texto_previo; if (!ex.url_oa && c.url_oa) ex.url_oa = c.url_oa; }
      else vistos.set(ch, { ...c, secoes: [tarefas[k].secao] });
    }
  });
  const basesComResultado = [...new Set([...vistos.values()].map((c) => c.base || "openalex"))];
  const { data: jaNoEstudo } = await sb.from("sources").select("*").eq("study_id", estudo.id);
  const existentes = new Set((jaNoEstudo || []).map((s: any) => (s.doi ? "doi:" + String(s.doi).toLowerCase() : "t:" + normalizar(s.titulo).slice(0, 90))));
  const idsExistentes = new Set((jaNoEstudo || []).map((s: any) => s.openalex_id));
  const candidatos = [...vistos.entries()].filter(([ch, c]) => !existentes.has(ch) && !idsExistentes.has(c.openalex_id)).map(([, c]) => c).slice(0, 120);
  if (!candidatos.length && !(jaNoEstudo || []).length) throw new Error("Nenhuma fonte acadêmica encontrada para este tema. Reformule o tema com termos mais usuais.");

  // 3. Triar relevância por seção
  await etapa(sb, levelId, `Selecionando as fontes mais relevantes entre ${candidatos.length} encontradas`);
  let escolhidos: Candidato[] = [];
  if (candidatos.length) {
    const lista = candidatos
      .map((c, i) => `[${i}] (${c.base}; seções ${(c.secoes || []).join(",")}) ${c.titulo} (${c.ano ?? "s.d."}; ${c.tipo}${c.grau ? ", " + c.grau : ""}; ${c.revista || c.editora || c.instituicao || "?"}; ${c.citacoes} citações)\n${(c.resumo || "").slice(0, 380)}`)
      .join("\n\n");
    const tri = await gerarJSON<{ selecionadas: { indice: number; secao: number; motivo: string }[] }>({
      modelo: MODELO_RAPIDO(),
      nome: "triagem",
      sistema: "Você seleciona bibliografia acadêmica de História com rigor. Descarte trabalhos fora do tema, de outras áreas sem relação histórica, resenhas muito curtas, textos sem conteúdo histórico substantivo e itens não acadêmicos (posts, apostilas, material religioso ou esotérico, pseudo-história).",
      usuario: `Tema: ${estudo.tema}\nPeríodo: ${periodo}\nNível ${n}: ${nivelPlano.titulo} — ${nivelPlano.objetivo}\nSeções do nível:\n${secoesPlano.map((s, i) => `${i + 1}. ${s.titulo} — ${s.pergunta_guia}`).join("\n")}\n\nEscolha de 12 a 16 trabalhos e indique a seção principal de cada um. Tente garantir pelo menos 2 trabalhos por seção. Prefira relevância direta, depois diversidade (artigos, teses, livros). Se houver poucos relevantes, escolha menos.\n\n${lista}`,
      schema: obj({ selecionadas: arr(obj({ indice: int, secao: int, motivo: str })) }),
      maxTokens: 2500,
    });
    escolhidos = tri.selecionadas
      .filter((s) => candidatos[s.indice])
      .slice(0, 16)
      .map((s) => ({ ...candidatos[s.indice], secoes: [...new Set([s.secao, ...(candidatos[s.indice].secoes || [])])] }));
  }

  // 4. Conferir metadados
  await etapa(sb, levelId, "Conferindo metadados pelo DOI na Crossref");
  escolhidos = await Promise.all(escolhidos.map((c) => (c.doi ? enriquecerCrossref(c) : c)));

  // 5. Ler textos completos em acesso aberto
  await etapa(sb, levelId, "Lendo os textos completos disponíveis em acesso aberto");
  const textos = await Promise.all(escolhidos.map((c) => (c.texto_previo ? Promise.resolve(c.texto_previo) : obterTextoCompleto(c.url_oa))));

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
      base: c.base || "openalex",
      instituicao: c.instituicao || null,
      grau: c.grau || null,
      secoes: c.secoes || null,
    }));
    const { error } = await sb.from("sources").upsert(linhas, { onConflict: "study_id,openalex_id" });
    if (error) throw new Error("Erro ao salvar fontes: " + error.message);
  }

  // Fontes usadas na escrita: as novas + até 5 anteriores mais relacionadas
  const { data: todas } = await sb.from("sources").select("*").eq("study_id", estudo.id);
  const novas = (todas || []).filter((s: any) => s.nivel === n) as FonteDB[];
  const consulta = `${estudo.tema} ${secoesPlano.map((s) => `${s.titulo} ${s.conteudos.join(" ")}`).join(" ")}`;
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
    usuario: `TEMA: ${estudo.tema}\nPERÍODO: ${periodo}\nNÍVEL ${n} DE 5 — ${nivel.nome}: ${nivelPlano.titulo}\nOBJETIVO DO NÍVEL: ${nivelPlano.objetivo}\nFIO CONDUTOR DO ESTUDO: ${planoEnsino.fio_condutor}\n${resumoAnteriores ? `NÍVEIS JÁ ESTUDADOS (não repita, aprofunde):\n${resumoAnteriores}\n` : ""}
PLANO DE ENSINO DESTE NÍVEL (siga exatamente esta ordem de seções):
${secoesPlano.map((sec, i) => `SEÇÃO ${i + 1}: ${sec.titulo}\n  Pergunta-guia: ${sec.pergunta_guia}\n  Deve cobrir: ${sec.conteudos.join("; ")}\n  Fontes encontradas para esta seção: ${usadas.filter((f: any) => (f.secoes || []).includes(i + 1)).map((f) => mat.rotulos[f.id]).join(", ") || "(nenhuma específica; use as gerais se servirem)"}`).join("\n")}

TAREFA: escreva o texto deste nível como uma aula escrita, com lógica de ensino: comece do mais básico e avance para o mais complexo, siga a ordem cronológica quando houver, e faça cada seção responder à sua pergunta-guia. Escreva de 2.000 a 2.600 palavras (3 a 4 páginas), com as seções do plano NA MESMA ORDEM e com os mesmos títulos (pode ajustar levemente a redação), parágrafos densos (4 a 7 frases).
- Use parágrafos "explicacao" para dar o fio didático: introduzir a seção, explicar conceitos, ligar uma seção à outra e retomar o que já foi visto. Use parágrafos "fonte" para todos os fatos, datas, nomes e interpretações.
- Cada seção deve ter pelo menos 2 parágrafos "fonte"; se as fontes não cobrem um conteúdo planejado, diga em um parágrafo "explicacao" que a bibliografia encontrada não trata dele, sem inventar.
- Em "fontes" de cada parágrafo liste os rótulos usados no texto (vazio nos parágrafos "explicacao").
- Traga citações diretas: em cada seção, coloque "citacao_direta" em pelo menos um parágrafo "fonte" sempre que o material tiver um trecho adequado (trechos literais de até 40 palavras; no máximo 10 no texto todo).
Também extraia, SOMENTE do material:
- "conceitos": 4 a 8 conceitos-chave com definição baseada nas fontes;
- "cronologia": eventos com ano explícito no material (o número do ano precisa aparecer no texto da fonte indicada);
- "lugares": lugares geográficos citados no material (nome no período, nome atual da cidade/região, país atual, papel no tema) e "secao", o número da seção (1, 2, 3...) em que o lugar aparece no texto, para o mapa ser mostrado logo abaixo dela;
- "dados_numericos": apenas séries numéricas que aparecem literalmente em um trecho do material (copie o trecho em "trecho_literal"); se não houver, devolva lista vazia.
"abertura": 2 a 3 frases apresentando o nível, sem marcadores.

MATERIAL DAS FONTES:
${mat.texto}`,
    schema: obj({
      titulo: str,
      abertura: str,
      secoes: arr(obj({ titulo: str, paragrafos: arr(obj({ tipo: { type: "string", enum: ["fonte", "explicacao"] }, texto: str, fontes: arr(str), citacao_direta: { anyOf: [obj({ fonte: str, trecho: str }), { type: "null" }] } })) })),
      conceitos: arr(obj({ termo: str, definicao: str, fontes: arr(str) })),
      cronologia: arr(obj({ ano: int, evento: str, fonte: str })),
      lugares: arr(obj({ nome_no_periodo: str, nome_atual: str, pais_atual: str, papel: str, fonte: str, secao: int })),
      dados_numericos: arr(obj({ titulo: str, unidade: str, serie: arr(obj({ rotulo: str, valor: num })), fonte: str, trecho_literal: str })),
    }),
  });

  // 8. Verificar tudo contra as fontes
  await etapa(sb, levelId, "Conferindo citações, datas e lugares contra o texto das fontes");
  const avisos: string[] = [];
  const idDe = (r: string) => mat.porRotulo[r.replace(/[\[\]\s]/g, "")]?.id;
  let removidos = 0, explRemovidas = 0, citDescartadas = 0, palavras = 0;
  // números que existem no material (para conferir parágrafos explicativos)
  const numsMaterial = new Set(Object.values(mat.porRotulo).flatMap((f) => (textoVerificavel(f).match(/\d{2,}/g) || [])));
  const secoes = escrita.secoes
    .map((s) => ({
      titulo: s.titulo,
      paragrafos: s.paragrafos
        .map((p) => {
          // marcadores no texto
          const noTexto = [...p.texto.matchAll(/\[(S\d+)\]/g)].map((m) => m[1]);
          const validos = [...new Set([...noTexto, ...p.fontes])].filter((r) => idDe(r));
          const texto = p.texto.replace(/\[(S\d+)\]/g, (m, r) => (idDe(r) ? `[[${idDe(r)}]]` : ""));
          if (!validos.length) {
            // Parágrafo explicativo: aceito só se não trouxer números/datas ausentes do material
            const nums = texto.match(/\d{2,}/g) || [];
            if (p.tipo === "explicacao" && nums.every((x) => numsMaterial.has(x))) {
              palavras += texto.split(/\s+/).length;
              return { tipo: "explicacao" as const, texto: texto.replace(/\s{2,}/g, " ").trim(), fontes: [] as string[], citacao: null };
            }
            if (p.tipo === "explicacao") explRemovidas++; else removidos++;
            return null;
          }
          let citacao: { fonte: string; trecho: string } | null = null;
          if (p.citacao_direta) {
            const f = mat.porRotulo[p.citacao_direta.fonte.replace(/[\[\]\s]/g, "")];
            if (f && trechoConfere(p.citacao_direta.trecho, textoVerificavel(f))) citacao = { fonte: f.id, trecho: p.citacao_direta.trecho.trim() };
            else citDescartadas++;
          }
          palavras += texto.split(/\s+/).length;
          return { tipo: "fonte" as const, texto, fontes: validos.map((r) => idDe(r)!), citacao };
        })
        .filter(Boolean),
    }))
    .filter((s) => s.paragrafos.some((p: any) => p?.tipo === "fonte"));
  if (removidos) avisos.push(`${removidos} parágrafo(s) com fatos foram removidos por não indicarem fonte.`);
  if (explRemovidas) avisos.push(`${explRemovidas} parágrafo(s) explicativo(s) foram removidos por trazerem datas ou números que não estão nas fontes.`);
  const totalPar = secoes.reduce((a, s) => a + s.paragrafos.length, 0);
  const comFonte = secoes.reduce((a, s) => a + s.paragrafos.filter((p: any) => p.tipo === "fonte").length, 0);
  const comCitacao = secoes.reduce((a, s) => a + s.paragrafos.filter((p: any) => p.citacao).length, 0);
  if (!comCitacao) avisos.push("Nenhuma citação direta pôde ser conferida no texto das fontes deste nível.");
  if (citDescartadas) avisos.push(`${citDescartadas} citação(ões) direta(s) foram descartadas porque o trecho não confere com o texto da fonte.`);
  if (palavras < 1600) avisos.push(`O texto ficou com cerca de ${palavras} palavras: as fontes encontradas não sustentaram um texto mais longo.`);
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
    .map((g) => ({ nome_no_periodo: g.nome_no_periodo, nome_atual: g.nome_atual, pais_atual: g.pais_atual, papel: g.papel, fonte: idDe(g.fonte)!, secao: g.secao, lat: g.geo!.lat, lon: g.geo!.lon }));
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
    estatisticas: { paragrafos: totalPar, comFonte, explicativos: totalPar - comFonte, citacoesDiretas: comCitacao },
    conceitos,
    avisos,
    palavras,
    fontes_usadas: usadas.map((f) => f.id),
    buscas: plano.buscas,
    bases: basesComResultado,
    plano: { titulo: nivelPlano.titulo, objetivo: nivelPlano.objetivo, perguntas: secoesPlano.map((x) => x.pergunta_guia) },
    modelo: process.env.OPENAI_MODEL || "gpt-4.1",
  };
  const { error } = await sb
    .from("levels")
    .update({ status: "pronto", etapa: null, erro: null, titulo: escrita.titulo, conteudo, mapa, graficos, cronologia, gerado_em: new Date().toISOString() })
    .eq("id", levelId);
  if (error) throw new Error(error.message);
}
