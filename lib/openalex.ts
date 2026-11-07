// Busca de artigos, livros e capítulos na OpenAlex e enriquecimento de metadados pela Crossref.
import { nomeABNT } from "./abnt";

const CONTATO = process.env.CONTATO_APIS || "";
const UA = `AtlasHistoriografico/1.0${CONTATO ? ` (mailto:${CONTATO})` : ""}`;

export type Candidato = {
  openalex_id: string;
  doi: string | null;
  tipo: string; // article | book | book-chapter
  titulo: string;
  autores: string[];
  ano: number | null;
  revista: string | null;
  editora: string | null;
  local: string | null;
  volume: string | null;
  numero: string | null;
  paginas: string | null;
  idioma: string | null;
  citacoes: number;
  resumo: string | null;
  url: string | null;
  url_oa: string | null;
};

async function getJSON(url: string, timeoutMs = 20000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${new URL(url).host}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function resumoDe(ii: Record<string, number[]> | null | undefined): string | null {
  if (!ii) return null;
  const arr: string[] = [];
  for (const [w, ps] of Object.entries(ii)) for (const p of ps) arr[p] = w;
  const s = arr.join(" ").replace(/\s+/g, " ").trim();
  return s.replace(/^(resumo|abstract|resumen|résumé)\s*[:.]?\s*/i, "") || null;
}

const SELECT = "id,doi,title,type,publication_year,authorships,primary_location,best_oa_location,biblio,language,cited_by_count,abstract_inverted_index";

function normalizar(w: any): Candidato | null {
  if (!w?.title) return null;
  const src = w.primary_location?.source || {};
  const tipo = w.type === "book" ? "book" : w.type === "book-chapter" ? "book-chapter" : "article";
  const fp = w.biblio?.first_page, lp = w.biblio?.last_page;
  const paginas = fp && lp && fp !== lp ? `${fp}-${lp}` : fp || null;
  return {
    openalex_id: String(w.id).split("/").pop()!,
    doi: w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//, "") : null,
    tipo,
    titulo: String(w.title).replace(/\s+/g, " ").trim(),
    autores: (w.authorships || []).map((a: any) => nomeABNT(a.author?.display_name || a.raw_author_name || "")).filter(Boolean),
    ano: w.publication_year ?? null,
    revista: tipo === "book" ? null : src.display_name || null,
    editora: tipo !== "article" ? src.host_organization_name || null : null,
    local: null,
    volume: w.biblio?.volume || null,
    numero: w.biblio?.issue || null,
    paginas,
    idioma: w.language || null,
    citacoes: w.cited_by_count || 0,
    resumo: resumoDe(w.abstract_inverted_index),
    url: w.primary_location?.landing_page_url || (w.doi ?? null),
    url_oa: w.best_oa_location?.pdf_url || w.best_oa_location?.landing_page_url || null,
  };
}

/** Busca por relevância, restrita a Artes e Humanidades / Ciências Sociais, com resumo disponível. */
export async function buscarObras(consulta: string, porPagina = 15): Promise<Candidato[]> {
  const p = new URLSearchParams({
    search: consulta,
    filter: "has_abstract:true,type:article|book|book-chapter,primary_topic.field.id:12|33",
    per_page: String(porPagina),
    select: SELECT,
  });
  if (CONTATO) p.set("mailto", CONTATO);
  const j = await getJSON(`https://api.openalex.org/works?${p}`);
  return (j.results || []).map(normalizar).filter(Boolean) as Candidato[];
}

/** Quantidade de trabalhos por década (dado real da OpenAlex) para o gráfico de produção acadêmica. */
export async function producaoPorDecada(consulta: string): Promise<{ consulta: string; decadas: { decada: number; total: number }[]; consultadoEm: string }> {
  const p = new URLSearchParams({ search: consulta, filter: "publication_year:1950-2025,primary_topic.field.id:12|33", group_by: "publication_year" });
  if (CONTATO) p.set("mailto", CONTATO);
  const j = await getJSON(`https://api.openalex.org/works?${p}`);
  const dec: Record<number, number> = {};
  for (const g of j.group_by || []) {
    const y = +g.key;
    if (!isFinite(y)) continue;
    const d = Math.floor(y / 10) * 10;
    dec[d] = (dec[d] || 0) + g.count;
  }
  return {
    consulta,
    decadas: Object.entries(dec).map(([d, t]) => ({ decada: +d, total: t })).sort((a, b) => a.decada - b.decada),
    consultadoEm: new Date().toISOString(),
  };
}

/** Completa e confere metadados pelo DOI na Crossref (título do livro, editora, local, páginas). */
export async function enriquecerCrossref(c: Candidato): Promise<Candidato> {
  if (!c.doi) return c;
  try {
    const j = await getJSON(`https://api.crossref.org/works/${encodeURIComponent(c.doi)}${CONTATO ? `?mailto=${encodeURIComponent(CONTATO)}` : ""}`, 12000);
    const m = j.message || {};
    const out = { ...c };
    const container = Array.isArray(m["container-title"]) ? m["container-title"][0] : null;
    if (c.tipo === "book-chapter" && container) out.revista = container;
    if (c.tipo === "article" && !out.revista && container) out.revista = container;
    if (!out.editora && m.publisher && c.tipo !== "article") out.editora = m.publisher;
    if (m["publisher-location"]) out.local = m["publisher-location"];
    if (!out.volume && m.volume) out.volume = String(m.volume);
    if (!out.numero && m.issue) out.numero = String(m.issue);
    if (m.page && (!out.paginas || !String(out.paginas).includes("-"))) out.paginas = String(m.page);
    if (!out.autores.length && Array.isArray(m.author))
      out.autores = m.author.map((a: any) => nomeABNT(a.family ? `${a.family}, ${a.given || ""}` : a.name || "")).filter(Boolean);
    return out;
  } catch {
    return c;
  }
}
