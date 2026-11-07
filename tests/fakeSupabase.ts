// Supabase em memória com o subconjunto da API usado pelo app (para testes).
import { randomUUID } from "node:crypto";
export function fakeSupabase(seed: Record<string, any[]> = {}) {
  const db: Record<string, any[]> = { studies: [], sources: [], levels: [], questions: [], messages: [], ...seed };
  function q(table: string) {
    const filtros: ((r: any) => boolean)[] = [];
    let op: "select" | "update" | "insert" | "upsert" | "delete" = "select";
    let payload: any = null, conflito: string[] = [], ordem: [string, boolean] | null = null, lim = 0, retornar = false;
    const exec = () => {
      const rows = db[table];
      if (op === "insert" || op === "upsert") {
        const lista = (Array.isArray(payload) ? payload : [payload]).map((r: any) => ({ ...r }));
        const out: any[] = [];
        for (const r of lista) {
          const ex = op === "upsert" ? rows.find((x) => conflito.every((c) => x[c] === r[c])) : null;
          if (ex) { Object.assign(ex, r); out.push(ex); }
          else { const n = { id: randomUUID(), created_at: new Date().toISOString(), lido: false, ...r }; rows.push(n); out.push(n); }
        }
        return out;
      }
      let sel = rows.filter((r) => filtros.every((f) => f(r)));
      if (op === "update") { sel.forEach((r) => Object.assign(r, payload)); return sel; }
      if (op === "delete") { db[table] = rows.filter((r) => !sel.includes(r)); return sel; }
      if (ordem) { const [c, asc] = ordem; sel = [...sel].sort((a, b) => (a[c] > b[c] ? 1 : -1) * (asc ? 1 : -1)); }
      if (lim) sel = sel.slice(0, lim);
      return sel;
    };
    const b: any = {
      select: () => { if (op !== "select") retornar = true; return b; },
      eq: (c: string, v: any) => (filtros.push((r) => r[c] === v), b),
      lt: (c: string, v: any) => (filtros.push((r) => r[c] < v), b),
      in: (c: string, v: any[]) => (filtros.push((r) => v.includes(r[c])), b),
      order: (c: string, o?: { ascending?: boolean }) => ((ordem = [c, o?.ascending !== false]), b),
      limit: (n: number) => ((lim = n), b),
      update: (p: any) => ((op = "update"), (payload = p), b),
      insert: (p: any) => ((op = "insert"), (payload = p), b),
      upsert: (p: any, o?: { onConflict?: string }) => ((op = "upsert"), (payload = p), (conflito = (o?.onConflict || "id").split(",")), b),
      delete: () => ((op = "delete"), b),
      single: async () => { const r = exec(); return r.length ? { data: r[0], error: null } : { data: null, error: { message: "não encontrado" } }; },
      maybeSingle: async () => ({ data: exec()[0] ?? null, error: null }),
      then: (ok: any, err: any) => Promise.resolve({ data: exec(), error: null }).then(ok, err),
    };
    return b;
  }
  return { db, from: q } as any;
}
