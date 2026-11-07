// Converte marcadores [[id-da-fonte]] do texto em citações autor-data ABNT.
export type Pedaco = { tipo: "texto"; v: string } | { tipo: "cit"; ids: string[]; v: string };

export function partirCitacoes(texto: string, chaves: Record<string, string>): Pedaco[] {
  const out: Pedaco[] = [];
  const re = /(?:\s*\[\[([0-9a-f-]{36})\]\])+/g;
  let ult = 0;
  for (const m of texto.matchAll(re)) {
    const ids = [...m[0].matchAll(/\[\[([0-9a-f-]{36})\]\]/g)].map((x) => x[1]).filter((id, i, a) => a.indexOf(id) === i);
    if (m.index! > ult) out.push({ tipo: "texto", v: texto.slice(ult, m.index) });
    const ks = ids.map((id) => chaves[id]).filter(Boolean);
    if (ks.length) out.push({ tipo: "cit", ids, v: ` (${ks.join("; ")})` });
    ult = m.index! + m[0].length;
  }
  if (ult < texto.length) out.push({ tipo: "texto", v: texto.slice(ult) });
  return out;
}

export const textoPlano = (texto: string, chaves: Record<string, string>) => partirCitacoes(texto, chaves).map((p) => p.v).join("");
