// Geocodificação dos lugares citados (nome atual -> coordenadas) via Nominatim/OpenStreetMap.
const CONTATO = process.env.CONTATO_APIS || "";
const UA = `AtlasHistoriografico/1.0${CONTATO ? ` (${CONTATO})` : ""}`;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type LugarGeo = { lat: number; lon: number; exibicao: string };

export async function geocodificar(nome: string, pais?: string | null): Promise<LugarGeo | null> {
  const q = [nome, pais].filter(Boolean).join(", ");
  const p = new URLSearchParams({ q, format: "jsonv2", limit: "1", "accept-language": "pt-BR" });
  if (CONTATO) p.set("email", CONTATO);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, { headers: { "User-Agent": UA }, cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.[0]) return null;
    return { lat: +j[0].lat, lon: +j[0].lon, exibicao: j[0].display_name };
  } catch {
    return null;
  }
}

/** Respeita o limite de 1 requisição por segundo da política do Nominatim. */
export async function geocodificarLista<T extends { nome_atual: string; pais_atual?: string | null }>(itens: T[]) {
  const out: (T & { geo: LugarGeo | null })[] = [];
  for (const it of itens) {
    out.push({ ...it, geo: await geocodificar(it.nome_atual, it.pais_atual) });
    await espera(1100);
  }
  return out;
}
