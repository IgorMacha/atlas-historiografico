import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/supabase/server";
import { responderChat } from "@/lib/chat";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { sb, user } = await usuarioAtual();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  const { pergunta } = await req.json().catch(() => ({}));
  if (!pergunta || typeof pergunta !== "string" || pergunta.length > 2000) return NextResponse.json({ erro: "Pergunta inválida." }, { status: 400 });
  try {
    const r = await responderChat(sb, params.id, pergunta.trim());
    await sb.from("messages").insert([
      { study_id: params.id, user_id: user.id, role: "user", conteudo: pergunta.trim() },
      { study_id: params.id, user_id: user.id, role: "assistant", conteudo: r.resposta, fontes: { ids: r.fontes, sem_base: r.sem_base } },
    ]);
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message || "Falha no chat." }, { status: 500 });
  }
}
