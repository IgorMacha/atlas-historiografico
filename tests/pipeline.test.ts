import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeSupabase } from "./fakeSupabase";

process.env.OPENAI_API_KEY = "sk-teste";
const RESUMO_A = "Neste artigo, analisa-se o mapa clássico das capitanias hereditárias da América Portuguesa quando foram criadas em 1534, propondo um novo desenho a partir das cartas de doação. As principais alterações referem-se às linhas de divisa nas capitanias do norte e à configuração das capitanias do sul.";
const RESUMO_B = "O artigo discute a capitania de Pernambuco e a vila de Olinda entre 1535 e 1630, com a produção de 66 engenhos em 1583 e 121 engenhos em 1630. A sociedade açucareira reunia senhores, lavradores e trabalhadores escravizados na várzea do Capibaribe.";
const TEXTO_OA = "<html><body><article>" + "Introdução longa sobre a colonização portuguesa e a administração. ".repeat(80) + "Os donatários deveriam povoar e defender a terra com recursos próprios, em troca de direitos fiscais.</article></body></html>";

const ii = (s: string) => { const o: Record<string, number[]> = {}; s.split(" ").forEach((w, i) => (o[w] ||= []).push(i)); return o; };
const obra = (id: string, titulo: string, resumo: string, oa: string | null) => ({
  id: `https://openalex.org/${id}`, doi: `https://doi.org/10.1/${id}`, title: titulo, type: "article", publication_year: 2013,
  authorships: [{ author: { display_name: "Jorge Pimentel Cintra" } }], primary_location: { source: { display_name: "Anais do Museu Paulista" }, landing_page_url: "https://x" },
  best_oa_location: oa ? { pdf_url: null, landing_page_url: oa } : null, biblio: { volume: "21", issue: "2", first_page: "11", last_page: "45" }, language: "pt", cited_by_count: 10, abstract_inverted_index: ii(resumo),
});

const respostas: Record<string, any> = {
  plano_de_ensino: {
    visao_geral: "Visão.", fio_condutor: "Fio.",
    niveis: [1, 2, 3, 4, 5].map((n) => ({ n, titulo: `Nível ${n}`, objetivo: "Objetivo", ano_referencia_mapa: 1540, secoes: [
      { titulo: "Origem", pergunta_guia: "Como surgiram?", conteudos: ["doações"], buscas: ["capitanias hereditárias", "hereditary captaincies", "donatários"] },
      { titulo: "Pernambuco", pergunta_guia: "Por que deu certo?", conteudos: ["engenhos"], buscas: ["Pernambuco engenhos", "Pernambuco sugar", "Olinda colonial"] },
    ] })),
  },
  plano: { buscas: ["capitanias hereditárias", "donatários Brasil colonial", "hereditary captaincies Brazil"], secoes: ["Origem", "Funcionamento", "Crise"], ano_referencia_mapa: 1540 },
  triagem: { selecionadas: [{ indice: 0, secao: 1, motivo: "central" }, { indice: 1, secao: 2, motivo: "estudo de caso" }, { indice: 2, secao: 2, motivo: "tese" }] },
  nivel: {
    titulo: "As capitanias hereditárias",
    abertura: "Este nível apresenta o sistema de capitanias.",
    secoes: [
      { titulo: "Origem", paragrafos: [
        { tipo: "fonte", texto: "As capitanias foram criadas em 1534 [S1]. Os donatários deviam povoar a terra [S1].", fontes: ["S1"], citacao_direta: { fonte: "S1", trecho: "propondo um novo desenho a partir das cartas de doação" } },
        { tipo: "explicacao", texto: "Para entender isso, vale pensar em como a Coroa delegava custos.", fontes: [], citacao_direta: null },
        { tipo: "explicacao", texto: "Isso mudou em 1549 com o governo-geral.", fontes: [], citacao_direta: null },
        { tipo: "fonte", texto: "Frase de fato sem fonte que deve sumir.", fontes: [], citacao_direta: null },
        { tipo: "fonte", texto: "Fonte inexistente [S9].", fontes: ["S9"], citacao_direta: null },
      ] },
      { titulo: "Pernambuco", paragrafos: [
        { tipo: "fonte", texto: "Olinda concentrou engenhos [S2].", fontes: ["S2"], citacao_direta: { fonte: "S2", trecho: "um trecho inventado que não está na fonte de jeito nenhum" } },
      ] },
    ],
    conceitos: [{ termo: "Donatário", definicao: "Quem recebia a capitania.", fontes: ["S1"] }, { termo: "Sem fonte", definicao: "x", fontes: ["S7"] }],
    cronologia: [{ ano: 1534, evento: "Criação das capitanias", fonte: "S1" }, { ano: 1549, evento: "Ano que não está na fonte", fonte: "S1" }, { ano: 1630, evento: "Engenhos", fonte: "S2" }],
    lugares: [{ nome_no_periodo: "Olinda", nome_atual: "Olinda", pais_atual: "Brasil", papel: "vila", fonte: "S2", secao: 2 }, { nome_no_periodo: "Salvador", nome_atual: "Salvador", pais_atual: "Brasil", papel: "capital", fonte: "S2", secao: 2 }],
    dados_numericos: [
      { titulo: "Engenhos em Pernambuco", unidade: "engenhos", serie: [{ rotulo: "1583", valor: 66 }, { rotulo: "1630", valor: 121 }], fonte: "S2", trecho_literal: "66 engenhos em 1583 e 121 engenhos em 1630" },
      { titulo: "Inventado", unidade: "x", serie: [{ rotulo: "a", valor: 5 }, { rotulo: "b", valor: 9 }], fonte: "S2", trecho_literal: "66 engenhos em 1583 e 121 engenhos em 1630" },
    ],
  },
  perguntas: { multipla: [{ enunciado: "Quando?", opcoes: ["1534", "1500", "1600", "1700"], correta: 0, explicacao: "Ver S1", fontes: ["S1"] }], abertas: [{ enunciado: "Explique.", resposta_esperada: "Os donatários...", fontes: ["S1"] }] },
};

globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url;
  const json = (o: any) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
  if (url.includes("api.openalex.org") && url.includes("group_by")) return json({ group_by: [{ key: "2013", count: 40 }, { key: "2021", count: 70 }, { key: "1999", count: 5 }] });
  if (url.includes("api.openalex.org")) return json({ results: [obra("W1", "Reconstruindo o mapa das capitanias", RESUMO_A, "https://oa.example/artigo"), obra("W2", "Pernambuco açucareiro", RESUMO_B, null)] });
  if (url.includes("semanticscholar")) return json({ data: [] });
  if (url.includes("archive.org/advancedsearch")) return json({ response: { docs: [] } });
  if (url.includes("bdtd.ibict.br")) return json({ records: [{ id: "T1", rawData: { title: ["Senhores de engenho em Pernambuco"], author: ["Souza, Maria de"], format: ["doctoralThesis"], publishDate: ["2015"], instname_str: "Universidade Federal de Pernambuco", url: ["https://repositorio.ufpe.br/handle/1"], description: "Esta tese analisa a sociedade açucareira de Pernambuco entre os séculos XVI e XVII, com atenção aos senhores de engenho, lavradores de cana e à organização da produção nas várzeas, a partir de inventários e documentação da Câmara de Olinda." } }] });
  if (url.includes("repositorio.ufpe.br")) return new Response("<html>curto</html>", { status: 200, headers: { "content-type": "text/html" } });
  if (url.includes("api.crossref.org")) return json({ message: { "publisher-location": "São Paulo", "container-title": ["Anais do Museu Paulista"] } });
  if (url.includes("oa.example")) return new Response(TEXTO_OA, { status: 200, headers: { "content-type": "text/html" } });
  if (url.includes("nominatim")) return json([{ lat: "-8.01", lon: "-34.86", display_name: "Olinda, PE, Brasil" }]);
  if (url.includes("api.openai.com")) {
    const body = JSON.parse(typeof init?.body === "string" ? init.body : await new Response(init?.body).text());
    const nome = body.response_format.json_schema.name;
    assert.ok(body.response_format.json_schema.strict);
    return json({ id: "x", object: "chat.completion", created: 0, model: body.model, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(respostas[nome]) } }] });
  }
  throw new Error("URL não simulada: " + url);
}) as any;

test("pipeline gera nível só com conteúdo verificável", async () => {
  const { gerarNivel } = await import("../lib/pipeline");
  const estudo = { id: "est-1", titulo: "Capitanias", tema: "Capitanias hereditárias (Período Colonial)", divisao: "brasil", periodo: "br-colonial", inicio: 1500, fim: 1822 };
  const sb = fakeSupabase({ studies: [estudo], levels: [{ id: "lv-1", study_id: "est-1", n: 1, status: "gerando" }] });
  await gerarNivel(sb, estudo, 1, "lv-1", "u1");
  const lv = sb.db.levels[0];
  assert.equal(lv.status, "pronto", lv.erro);
  const c = lv.conteudo;
  // parágrafos sem fonte ou com fonte inexistente são removidos
  // explicativo sem números novos fica; explicativo com data inventada e parágrafo de fato sem fonte saem
  assert.equal(c.secoes[0].paragrafos.length, 2);
  assert.equal(c.secoes[0].paragrafos[1].tipo, "explicacao");
  assert.match(c.avisos.join(" "), /2 parágrafo\(s\) com fatos/);
  assert.match(c.avisos.join(" "), /1 parágrafo\(s\) explicativo/);
  assert.equal(c.estatisticas.citacoesDiretas, 1);
  // citação direta: a literal fica, a inventada sai
  assert.ok(c.secoes[0].paragrafos[0].citacao);
  assert.equal(c.secoes[1].paragrafos[0].citacao, null);
  assert.match(c.avisos.join(" "), /1 citação/);
  // marcadores viram ids das fontes
  assert.match(c.secoes[0].paragrafos[0].texto, /\[\[[0-9a-f-]{36}\]\]/);
  assert.equal(c.conceitos.length, 1);
  // cronologia: 1549 não aparece na fonte
  assert.deepEqual(lv.cronologia.map((e: any) => e.ano), [1534, 1630]);
  // lugares: Salvador não está no texto da fonte S2
  assert.equal(lv.mapa.lugares.length, 1);
  assert.equal(lv.mapa.lugares[0].secao, 2);
  // plano de ensino salvo no estudo e tese da BDTD salva com ABNT de tese
  assert.equal(sb.db.studies[0].plano.niveis.length, 5);
  const tese = sb.db.sources.find((s: any) => s.base === "bdtd");
  assert.ok(tese, "tese da BDTD deveria ser selecionada");
  assert.match(tese.abnt, /SOUZA, Maria de\. Senhores de engenho em Pernambuco\. 2015\. Tese \(Doutorado\) – Universidade Federal de Pernambuco/);
  assert.equal(lv.mapa.basemap, "world_1530");
  // dados numéricos: só a série cujos números estão no trecho
  assert.equal(lv.graficos.dados.length, 1);
  assert.equal(lv.graficos.producao.decadas.length, 3);
  // fontes salvas com ABNT e texto completo
  assert.equal(sb.db.sources.length, 3);
  assert.ok(sb.db.sources.find((s: any) => s.openalex_id === "W1").texto_completo.includes("donatários"));
  assert.match(sb.db.sources[0].abnt, /CINTRA, Jorge Pimentel\. .*São Paulo, v\. 21, n\. 2, p\. 11-45, 2013\. DOI: https:\/\/doi\.org\//);
  assert.equal(sb.db.questions.length, 2);
  if (process.env.DUMP) (await import("node:fs")).writeFileSync(process.env.DUMP, JSON.stringify(sb.db));
});

test("chat responde só com fontes e marca sem_base", async () => {
  respostas.chat = { resposta: "Segundo as fontes, foram criadas em 1534 [S1]. Também [S8].", fontes: ["S1"], sem_base: false };
  const { responderChat } = await import("../lib/chat");
  const estudo = { id: "est-2", tema: "Capitanias" };
  const sb = fakeSupabase({ studies: [estudo], sources: [{ id: "f1-0000-0000-0000-000000000000", study_id: "est-2", titulo: "Capitanias", autores: ["CINTRA, J"], ano: 2013, resumo: RESUMO_A, tipo: "article" }] });
  const r = await responderChat(sb, "est-2", "Quando foram criadas as capitanias?");
  assert.ok(!r.resposta.includes("[S8]"));
  assert.ok(r.resposta.includes("[[f1-0000-0000-0000-000000000000]]"));
  assert.deepEqual(r.fontes, ["f1-0000-0000-0000-000000000000"]);
});
