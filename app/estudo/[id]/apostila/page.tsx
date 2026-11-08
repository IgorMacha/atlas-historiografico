import { notFound, redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { ApostilaDoc } from "@/components/ApostilaDoc";

export const dynamic = "force-dynamic";

export default async function Apostila({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string> }) {
  const { sb, user } = await usuarioAtual();
  if (!user) redirect("/login");
  const { data: estudo } = await sb.from("studies").select("*").eq("id", params.id).maybeSingle();
  if (!estudo) notFound();
  const so = searchParams.n ? Number(searchParams.n) : null;
  let q = sb.from("levels").select("*").eq("study_id", estudo.id).eq("status", "pronto").order("n");
  if (so) q = q.eq("n", so);
  const [{ data: niveis }, { data: fontes }, { data: perguntas }] = await Promise.all([
    q,
    sb.from("sources").select("id,tipo,titulo,autores,ano,revista,editora,local,volume,numero,paginas,doi,url,grau,instituicao").eq("study_id", estudo.id),
    sb.from("questions").select("*").eq("study_id", estudo.id).order("ordem"),
  ]);
  return <ApostilaDoc estudo={estudo} niveis={(niveis || []) as any[]} fontes={(fontes || []) as any[]} perguntas={(perguntas || []) as any[]} so={so} autor={process.env.AUTOR_NOME || user.email || ""} imprimir={searchParams.imprimir === "1"} comPerguntas={searchParams.perguntas !== "0"} />;
}

