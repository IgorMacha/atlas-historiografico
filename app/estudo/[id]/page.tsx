import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Topo from "@/components/Topo";
import Pasta from "@/components/Pasta";
import { usuarioAtual } from "@/lib/supabase/server";
import { excluirEstudo } from "@/app/acoes";

export const dynamic = "force-dynamic";
const COLS_FONTE = "id,openalex_id,doi,tipo,titulo,autores,ano,revista,editora,local,volume,numero,paginas,idioma,citacoes,resumo,url,url_oa,abnt,nivel,lido,texto_completo";

export default async function PaginaEstudo({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string> }) {
  const { sb, user } = await usuarioAtual();
  if (!user) redirect("/login");
  const { data: estudo } = await sb.from("studies").select("*").eq("id", params.id).maybeSingle();
  if (!estudo) notFound();
  const [{ data: niveis }, { data: fontes }, { data: perguntas }, { data: mensagens }] = await Promise.all([
    sb.from("levels").select("*").eq("study_id", estudo.id).order("n"),
    sb.from("sources").select(COLS_FONTE).eq("study_id", estudo.id),
    sb.from("questions").select("*").eq("study_id", estudo.id),
    sb.from("messages").select("*").eq("study_id", estudo.id).order("created_at"),
  ]);
  const fs = (fontes || []).map(({ texto_completo, ...f }: any) => ({ ...f, tem_texto: !!texto_completo }));
  return (
    <>
      <Topo />
      <main className="pagina">
        {searchParams.erro === "confirmar" && <p className="aviso forte">Para excluir, digite EXCLUIR.</p>}
        <Suspense>
          <Pasta estudo={estudo} niveis={(niveis || []) as any} fontes={fs as any} perguntas={(perguntas || []) as any} mensagens={(mensagens || []) as any} />
        </Suspense>
        <details className="sec small">
          <summary className="muted">Excluir este estudo</summary>
          <form action={excluirEstudo} className="linha" style={{ marginTop: 8 }}>
            <input type="hidden" name="id" value={estudo.id} />
            <label htmlFor="confirmar" className="muted">Digite EXCLUIR para apagar a pasta, níveis, fontes, perguntas e chat:</label>
            <input id="confirmar" name="confirmar" className="campo" style={{ maxWidth: 160 }} />
            <button className="btn" type="submit">Excluir</button>
          </form>
        </details>
      </main>
    </>
  );
}
