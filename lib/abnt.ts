// Formatação ABNT (NBR 6023:2018 para referências; NBR 10520:2023 para citações autor-data).
export type FonteRef = {
  id: string;
  tipo?: string | null; // article | book | book-chapter | other
  titulo: string;
  autores: string[]; // já no formato "SOBRENOME, Prenome"
  ano?: number | null;
  revista?: string | null; // periódico ou, em capítulos, título do livro
  editora?: string | null;
  local?: string | null;
  volume?: string | null;
  numero?: string | null;
  paginas?: string | null;
  doi?: string | null;
  url?: string | null;
};

const SUFIXOS = ["júnior", "junior", "jr.", "jr", "filho", "neto", "sobrinho", "segundo"];

/** "Jorge Pimentel Cintra" -> "CINTRA, Jorge Pimentel"; "Hilário Franco Júnior" -> "FRANCO JÚNIOR, Hilário" */
export function nomeABNT(nome: string): string {
  const n = (nome || "").replace(/\s+/g, " ").trim();
  if (!n) return "";
  if (n.includes(",")) {
    const [sob, ...rest] = n.split(",");
    return `${sob.trim().toLocaleUpperCase("pt-BR")}, ${rest.join(",").trim()}`.replace(/,\s*$/, "");
  }
  const parts = n.split(" ");
  if (parts.length === 1) return parts[0].toLocaleUpperCase("pt-BR");
  let k = parts.length - 1;
  if (SUFIXOS.includes(parts[k].toLowerCase()) && k > 0) k -= 1;
  const sobrenome = parts.slice(k).join(" ").toLocaleUpperCase("pt-BR");
  const prenome = parts.slice(0, k).join(" ");
  return prenome ? `${sobrenome}, ${prenome}` : sobrenome;
}

export const sobrenomeDe = (a: string) => (a.split(",")[0] || a).trim();

function autoresRef(a: string[]): string {
  if (!a.length) return "";
  if (a.length > 3) return `${a[0]} et al.`;
  return a.join("; ");
}

function paginas(p?: string | null) {
  if (!p) return "";
  const s = String(p).replace(/\s/g, "").replace(/-$/, "");
  return s.includes("-") ? `p. ${s}` : `p. ${s}`;
}

function linkDoi(doi?: string | null) {
  if (!doi) return "";
  const d = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return `https://doi.org/${d}`;
}

/** Referência em partes: { antes, destaque, depois } para permitir negrito no título correto. */
export function referenciaPartes(f: FonteRef): { antes: string; destaque: string; depois: string } {
  const aut = autoresRef(f.autores);
  const ano = f.ano ? String(f.ano) : "[s. d.]";
  const doi = f.doi ? ` DOI: ${linkDoi(f.doi)}.` : f.url ? ` Disponível em: ${f.url}.` : "";
  const local = f.local || "[s. l.]";
  const titulo = f.titulo.replace(/\.$/, "");
  if (f.tipo === "book") {
    const [t1, ...sub] = titulo.split(":");
    return {
      antes: `${aut ? aut + ". " : ""}`,
      destaque: t1.trim(),
      depois: `${sub.length ? ": " + sub.join(":").trim() : ""}. ${local}: ${f.editora || "[s. n.]"}, ${ano}.${doi}`,
    };
  }
  if (f.tipo === "book-chapter") {
    return {
      antes: `${aut ? aut + ". " : ""}${titulo}. In: `,
      destaque: (f.revista || "[título do livro não informado]").replace(/\.$/, ""),
      depois: `. ${local}: ${f.editora || "[s. n.]"}, ${ano}.${f.paginas ? " " + paginas(f.paginas) + "." : ""}${doi}`,
    };
  }
  const resto = [f.local, f.volume ? `v. ${f.volume}` : "", f.numero ? `n. ${f.numero}` : "", paginas(f.paginas), ano]
    .filter(Boolean)
    .join(", ");
  return {
    antes: `${aut ? aut + ". " : ""}${titulo}. `,
    destaque: (f.revista || "[periódico não informado]").replace(/\.$/, ""),
    depois: `, ${resto}.${doi}`,
  };
}

export function referenciaTexto(f: FonteRef): string {
  const p = referenciaPartes(f);
  return `${p.antes}${p.destaque}${p.depois}`.replace(/\s+/g, " ").trim();
}

/** Ordena alfabeticamente como pede a ABNT (sistema autor-data). */
export function ordenarReferencias<T extends FonteRef>(fs: T[]): T[] {
  return [...fs].sort((a, b) => referenciaTexto(a).localeCompare(referenciaTexto(b), "pt-BR"));
}

const MINUS = new Set(["de", "da", "do", "das", "dos", "e"]);
/** NBR 10520:2023: sobrenome em maiúsculas e minúsculas dentro dos parênteses: (Cintra, 2013). */
export function capitalizar(s: string) {
  return s
    .toLocaleLowerCase("pt-BR")
    .split(/(\s|-)/)
    .map((w, i) => (i > 0 && MINUS.has(w) ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1)))
    .join("");
}

/**
 * Chaves de citação autor-data com letras para mesmo autor e ano: (CINTRA, 2013a).
 * Retorna mapa id -> "Cintra, 2013" | "Funari; Garraffoni, 2019" | "Araujo et al., 2017".
 */
export function chavesCitacao(fs: FonteRef[]): Record<string, string> {
  const base: Record<string, string> = {};
  for (const f of fs) {
    const s = f.autores.map((a) => capitalizar(sobrenomeDe(a)));
    const quem = !s.length ? (f.titulo.split(" ")[0] || "").toLocaleUpperCase("pt-BR") + "…" : s.length > 3 ? `${s[0]} et al.` : s.join("; ");
    base[f.id] = `${quem}, ${f.ano ?? "[s. d.]"}`;
  }
  const grupos: Record<string, string[]> = {};
  for (const f of ordenarReferencias(fs)) (grupos[base[f.id]] ||= []).push(f.id);
  const out: Record<string, string> = {};
  for (const [k, ids] of Object.entries(grupos)) {
    if (ids.length === 1) out[ids[0]] = k;
    else ids.forEach((id, i) => (out[id] = k + String.fromCharCode(97 + i)));
  }
  return out;
}
