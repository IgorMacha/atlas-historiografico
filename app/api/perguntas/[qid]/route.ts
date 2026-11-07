import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/supabase/server";
import { corrigirAberta } from "@/lib/chat";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { qid: string } }) {
  const { sb, user } = await usuarioAtual();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  const { resposta } = await req.json().catch(() => ({}));
  if (resposta == null || String(resposta).length > 6000) return NextResponse.json({ erro: "Resposta inválida." }, { status: 400 });
  const { data: q } = await sb.from("questions").select("*").eq("id", params.qid).single();
  if (!q) return NextResponse.json({ erro: "Pergunta não encontrada." }, { status: 404 });
  let upd: Record<string, unknown>;
  if (q.tipo === "multipla") {
    const ok = String(resposta) === String(q.gabarito);
    upd = { resposta: String(resposta), nota: ok ? 10 : 0, feedback: q.explicacao };
  } else {
    const ids: string[] = q.fontes || [];
    const { data: fs } = ids.length ? await sb.from("sources").select("abnt,resumo").in("id", ids) : { data: [] as any[] };
    const material = (fs || []).map((f: any) => `${f.abnt}\n${f.resumo || ""}`).join("\n\n");
    try {
      const c = await corrigirAberta(q.enunciado, q.gabarito, String(resposta), material);
      const fb = [c.feedback, c.acertos.length ? `Acertos: ${c.acertos.join("; ")}.` : "", c.faltou.length ? `Faltou: ${c.faltou.join("; ")}.` : ""].filter(Boolean).join("\n");
      upd = { resposta: String(resposta), nota: Math.max(0, Math.min(10, c.nota)), feedback: fb };
    } catch (e: any) {
      return NextResponse.json({ erro: e?.message || "Falha na correção." }, { status: 500 });
    }
  }
  const { data, error } = await sb.from("questions").update({ ...upd, respondida_em: new Date().toISOString() }).eq("id", q.id).select().single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json(data);
}
