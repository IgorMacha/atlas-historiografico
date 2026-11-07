"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { usuarioAtual } from "@/lib/supabase/server";
import { periodoPorId } from "@/lib/periodos";

export async function criarEstudo(fd: FormData) {
  const { sb, user } = await usuarioAtual();
  if (!user) redirect("/login");
  const periodo = periodoPorId(String(fd.get("periodo") || ""));
  const tema = String(fd.get("tema") || "").trim().slice(0, 300);
  if (!tema) redirect("/?erro=tema");
  const { data, error } = await sb
    .from("studies")
    .insert({
      user_id: user.id,
      titulo: tema.charAt(0).toUpperCase() + tema.slice(1),
      tema: periodo ? `${tema} (${periodo.nome}, ${periodo.rotulo}${periodo.divisao === "brasil" ? ", História do Brasil" : ""})` : tema,
      divisao: periodo ? periodo.divisao : "livre",
      periodo: periodo?.id ?? null,
      inicio: periodo?.inicio ?? null,
      fim: periodo?.fim ?? null,
    })
    .select("id")
    .single();
  if (error || !data) redirect(`/?erro=${encodeURIComponent(error?.message || "falha")}`);
  redirect(`/estudo/${data.id}?gerar=1`);
}

export async function concluirNivel(studyId: string, n: number, concluido: boolean) {
  const { sb } = await usuarioAtual();
  await sb.from("levels").update({ concluido_em: concluido ? new Date().toISOString() : null }).eq("study_id", studyId).eq("n", n);
  const { data: lv } = await sb.from("levels").select("n,concluido_em").eq("study_id", studyId);
  const feitos = (lv || []).filter((l: any) => l.concluido_em).map((l: any) => l.n);
  let prox = 1;
  while (feitos.includes(prox) && prox < 5) prox++;
  await sb.from("studies").update({ nivel_atual: prox }).eq("id", studyId);
  revalidatePath(`/estudo/${studyId}`);
}

export async function salvarAnotacoes(studyId: string, texto: string) {
  const { sb } = await usuarioAtual();
  await sb.from("studies").update({ anotacoes: texto.slice(0, 100_000) }).eq("id", studyId);
}

export async function marcarLida(sourceId: string, lido: boolean) {
  const { sb } = await usuarioAtual();
  await sb.from("sources").update({ lido }).eq("id", sourceId);
}

export async function excluirEstudo(fd: FormData) {
  const { sb } = await usuarioAtual();
  const id = String(fd.get("id") || "");
  if (String(fd.get("confirmar") || "") !== "EXCLUIR") redirect(`/estudo/${id}?erro=confirmar`);
  await sb.from("studies").delete().eq("id", id);
  redirect("/");
}
