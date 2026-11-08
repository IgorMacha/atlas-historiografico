// Bases acadêmicas adicionais: Semantic Scholar, CORE, BDTD (teses e dissertações) e Internet Archive.
// Todas devolvem o mesmo formato (Candidato) usado pela OpenAlex. Falhas de uma base nunca derrubam a busca.
import { nomeABNT } from "../abnt";
import { getJSON, type Candidato } from "../openalex";

const limpar = (s?: string | null) => (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;

/** Semantic Scholar (Allen Institute). Chave opcional em SEMANTIC_SCHOLAR_API_KEY (sem chave o limite é compartilhado). */
export async function buscarSemanticScholar(q: string, n = 10): Promise<Candidato[]> {
  const p = new URLSearchParams({ query: q, limit: String(n), fields: "title,abstract,year,authors,venue,externalIds,openAccessPdf,citationCount,publicationTypes,journal,url" });
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY;
  const j = await getJSON(`https://api.semanticscholar.org/graph/v1/paper/search?${p}`, 15000, key ? { "x-api-key": key } : {});
  return (j.data || [])
    .filter((w: any) => w.title && w.abstract)
    .map((w: any): Candidato => {
      const tipos: string[] = w.publicationTypes || [];
      const tipo = tipos.includes("Book") ? "book" : tipos.includes("BookSection") ? "book-chapter" : "article";
      return {
        openalex_id: `S2:${w.paperId}`,
        base: "semantic_scholar",
        doi: w.externalIds?.DOI || null,
        tipo,
        titulo: limpar(w.title)!,
        autores: (w.authors || []).map((a: any) => nomeABNT(a.name || "")).filter(Boolean),
        ano: w.year ?? null,
        revista: w.journal?.name || w.venue || null,
        editora: null,
        local: null,
        volume: w.journal?.volume || null,
        numero: null,
        paginas: w.journal?.pages ? String(w.journal.pages).trim() : null,
        idioma: null,
        citacoes: w.citationCount || 0,
        resumo: limpar(w.abstract),
        url: w.url || null,
        url_oa: w.openAccessPdf?.url || null,
      };
    });
}

/** CORE (acesso aberto, muitas vezes com texto completo). Requer CORE_API_KEY gratuita (core.ac.uk/services/api). */
export async function buscarCore(q: string, n = 8): Promise<Candidato[]> {
  const key = process.env.CORE_API_KEY;
  if (!key) return [];
  const p = new URLSearchParams({ q: `(${q}) AND _exists_:abstract`, limit: String(n) });
  const j = await getJSON(`https://api.core.ac.uk/v3/search/works?${p}`, 20000, { Authorization: `Bearer ${key}` });
  return (j.results || [])
    .filter((w: any) => w.title && w.abstract)
    .map((w: any): Candidato => ({
      openalex_id: `CORE:${w.id}`,
      base: "core",
      doi: w.doi || null,
      tipo: /thesis|tese|disserta/i.test(w.documentType || "") ? "thesis" : "article",
      titulo: limpar(w.title)!,
      autores: (w.authors || []).map((a: any) => nomeABNT(a.name || "")).filter(Boolean),
      ano: w.yearPublished ?? null,
      revista: w.journals?.[0]?.title || null,
      editora: w.publisher || null,
      local: null,
      volume: null,
      numero: null,
      paginas: null,
      idioma: w.language?.code || null,
      citacoes: w.citationCount || 0,
      resumo: limpar(w.abstract),
      url: w.links?.find((l: any) => l.type === "display")?.url || (w.doi ? `https://doi.org/${w.doi}` : null),
      url_oa: w.downloadUrl || null,
      texto_previo: w.fullText ? String(w.fullText).slice(0, 120_000) : null,
    }));
}

/** BDTD — Biblioteca Digital Brasileira de Teses e Dissertações (IBICT), via API VuFind. */
export async function buscarBdtd(q: string, n = 8): Promise<Candidato[]> {
  const p = new URLSearchParams({ lookfor: q, type: "AllFields", limit: String(n) });
  p.append("field[]", "id");
  p.append("field[]", "rawData");
  const j = await getJSON(`https://bdtd.ibict.br/vufind/api/v1/search?${p}`, 20000);
  return (j.records || [])
    .map((r: any): Candidato | null => {
      const raw = r.rawData || {};
      const titulo = limpar(Array.isArray(raw.title) ? raw.title[0] : raw.title);
      const descs: string[] = Array.isArray(raw.description) ? raw.description : raw.description ? [raw.description] : [];
      const resumo = limpar(descs.find((d) => /\b(o|a|os|as|de|que|e)\b/i.test(d) && /ção|ões|ê|ã/.test(d)) || descs[0]);
      if (!titulo || !resumo) return null;
      const fmt: string = (raw.format || [])[0] || "";
      const autores = (raw.author || []).map((a: string) => nomeABNT(a)).filter(Boolean);
      const ano = Number((raw.publishDate || [])[0]) || null;
      const pub = (raw["dc.publisher.none.fl_str_mv"] || [])[0] || null;
      const inst = Array.isArray(raw.instname_str) ? raw.instname_str[0] : raw.instname_str || (raw.institution || [])[0] || null;
      const url = (raw.url || [])[0] || (raw["dc.identifier.uri.fl_str_mv"] || [])[0] || null;
      return {
        openalex_id: `BDTD:${r.id}`,
        base: "bdtd",
        doi: null,
        tipo: "thesis",
        grau: /doctoral/i.test(fmt) ? "Tese (Doutorado)" : /master/i.test(fmt) ? "Dissertação (Mestrado)" : "Trabalho acadêmico",
        instituicao: inst || pub,
        titulo,
        autores,
        ano,
        revista: null,
        editora: pub,
        local: null,
        volume: null,
        numero: null,
        paginas: null,
        idioma: (raw.language || [])[0] || "pt",
        citacoes: 0,
        resumo,
        url,
        url_oa: url,
      };
    })
    .filter(Boolean) as Candidato[];
}

/** Internet Archive — livros e textos digitalizados (inclui obras clássicas e fontes primárias em domínio público). */
export async function buscarInternetArchive(q: string, n = 6): Promise<Candidato[]> {
  const p = new URLSearchParams({ q: `(${q}) AND mediatype:texts AND (language:por OR language:eng OR language:spa OR language:Portuguese OR language:English)`, rows: String(n), output: "json" });
  for (const f of ["identifier", "title", "creator", "date", "publisher", "language", "description"]) p.append("fl[]", f);
  const j = await getJSON(`https://archive.org/advancedsearch.php?${p}`, 20000);
  return (j.response?.docs || [])
    .map((d: any): Candidato | null => {
      const resumo = limpar(Array.isArray(d.description) ? d.description.join(" ") : d.description);
      const titulo = limpar(Array.isArray(d.title) ? d.title[0] : d.title);
      if (!titulo || !resumo || resumo.length < 200) return null;
      const criadores: string[] = Array.isArray(d.creator) ? d.creator : d.creator ? [d.creator] : [];
      return {
        openalex_id: `IA:${d.identifier}`,
        base: "internet_archive",
        doi: null,
        tipo: "book",
        titulo,
        autores: criadores.map((c) => nomeABNT(c.replace(/,\s*\d{4}-?\d*$/, ""))).filter(Boolean),
        ano: Number(String(d.date || "").slice(0, 4)) || null,
        revista: null,
        editora: Array.isArray(d.publisher) ? d.publisher[0] : d.publisher || null,
        local: null,
        volume: null,
        numero: null,
        paginas: null,
        idioma: Array.isArray(d.language) ? d.language[0] : d.language || null,
        citacoes: 0,
        resumo: resumo.slice(0, 3000),
        url: `https://archive.org/details/${d.identifier}`,
        url_oa: `https://archive.org/download/${d.identifier}/${d.identifier}_djvu.txt`,
      };
    })
    .filter(Boolean) as Candidato[];
}

