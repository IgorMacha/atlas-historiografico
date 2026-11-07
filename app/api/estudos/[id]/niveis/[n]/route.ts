import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { usuarioAtual } from "@/lib/supabase/server";
import { gerarNivel } from "@/lib/pipeline";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Inicia a geração do nível n. Roda em segundo plano; a tela acompanha pelo campo "etapa". */
export async function POST(_req: Request, { params }: { params: { id: string; n: string } }) {
  const { sb, user } = await usuarioAtual();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  const n = Number(params.n);
  if (!(n >= 1 && n <= 5)) return NextResponse.json({ erro: "Nível inválido." }, { status: 400 });
  const { data: estudo } = await sb.from("studies").select("*").eq("id", params.id).single();
  if (!estudo) return NextResponse.json({ erro: "Estudo não encontrado." }, { status: 404 });
  if (n > 1) {
    const { data: ant } = await sb.from("levels").select("status").eq("study_id", estudo.id).eq("n", n - 1).single();
    if (ant?.status !== "pronto") return NextResponse.json({ erro: `Gere o nível ${n - 1} antes.` }, { status: 409 });
  }
  const { data: atual } = await sb.from("levels").select("*").eq("study_id", estudo.id).eq("n", n).maybeSingle();
  if (atual?.status === "gerando" && atual.created_at && Date.now() - new Date(atual.gerado_em || atual.created_at).getTime() < 6 * 60_000)
    return NextResponse.json({ erro: "Este nível já está sendo gerado." }, { status: 409 });

  const { data: nivel, error } = await sb
    .from("levels")
    .upsert({ study_id: estudo.id, user_id: user.id, n, status: "gerando", etapa: "Iniciando", erro: null, gerado_em: new Date().toISOString() }, { onConflict: "study_id,n" })
    .select()
    .single();
  if (error || !nivel) return NextResponse.json({ erro: error?.message || "Falha ao criar nível." }, { status: 500 });

  waitUntil(
    gerarNivel(sb, estudo, n, nivel.id, user.id).catch(async (e) => {
      console.error(e);
      await sb.from("levels").update({ status: "erro", etapa: null, erro: String(e?.message || e) }).eq("id", nivel.id);
    })
  );
  return NextResponse.json({ ok: true, levelId: nivel.id }, { status: 202 });
}
