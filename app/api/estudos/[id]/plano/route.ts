import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/supabase/server";
import { gerarPlanoDeEnsino } from "@/lib/plano";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

/** Gera (ou refaz, com ?refazer=1) o plano de ensino dos 5 níveis do estudo. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { sb, user } = await usuarioAtual();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  const { data: estudo } = await sb.from("studies").select("*").eq("id", params.id).single();
  if (!estudo) return NextResponse.json({ erro: "Estudo não encontrado." }, { status: 404 });
  const refazer = new URL(req.url).searchParams.get("refazer") === "1";
  if (estudo.plano?.niveis?.length && !refazer) return NextResponse.json(estudo.plano);
  try {
    return NextResponse.json(await gerarPlanoDeEnsino(sb, estudo));
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message || "Falha ao montar o plano de ensino." }, { status: 500 });
  }
}
