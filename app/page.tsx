import Link from "next/link";
import Topo from "@/components/Topo";
import NovoEstudo from "@/components/NovoEstudo";
import { usuarioAtual } from "@/lib/supabase/server";
import { periodoPorId } from "@/lib/periodos";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Inicio({ searchParams }: { searchParams: Record<string, string> }) {
  const { sb, user } = await usuarioAtual();
  if (!user) redirect("/login");
  const [{ data: estudos }, { data: niveis }, { data: fontes }] = await Promise.all([
    sb.from("studies").select("*").order("updated_at", { ascending: false }),
    sb.from("levels").select("study_id,n,status,concluido_em"),
    sb.from("sources").select("study_id"),
  ]);
  const contagem: Record<string, number> = {};
  for (const e of estudos || []) if (e.periodo) contagem[e.periodo] = (contagem[e.periodo] || 0) + 1;
  const nf: Record<string, number> = {};
  for (const f of fontes || []) nf[f.study_id] = (nf[f.study_id] || 0) + 1;
  return (
    <>
      <Topo />
      <main className="pagina">
        <div className="olho">Graduação em História · 5 níveis por tema</div>
        <h1>O que você quer estudar?</h1>
        <p className="lead">Escolha um período e um tema. O Atlas monta uma linha de estudo em cinco níveis, só com artigos e livros acadêmicos encontrados e conferidos, com mapas, gráficos, perguntas e referências ABNT.</p>
        {searchParams.erro && <p className="aviso forte sec">Não foi possível criar o estudo: {searchParams.erro === "tema" ? "escreva um tema." : searchParams.erro}</p>}
        {!!(estudos || []).length && (
          <section className="sec">
            <div className="rot">Minhas pastas de estudo</div>
            <div className="pastas">
              {(estudos || []).map((e: any) => {
                const lv = (niveis || []).filter((l: any) => l.study_id === e.id);
                const p = periodoPorId(e.periodo);
                return (
                  <Link key={e.id} href={`/estudo/${e.id}`} className="pasta">
                    <div className="linha entre small muted"><span>{p ? `${p.divisao === "brasil" ? "Brasil" : "Mundo"} · ${p.nome}` : "Tema livre"}</span><span>{nf[e.id] || 0} fontes</span></div>
                    <h3>{e.titulo}</h3>
                    <div className="niveis5" aria-label="Níveis">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const l = lv.find((x: any) => x.n === n);
                        return <span key={n} className={l?.concluido_em ? "feito" : l?.status === "pronto" ? "pronto" : l?.status === "gerando" ? "gerando" : ""} title={`Nível ${n}`} />;
                      })}
                    </div>
                    <div className="small muted">Nível atual: {e.nivel_atual} · atualizado em {new Date(e.updated_at).toLocaleDateString("pt-BR")}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
        <NovoEstudo contagem={contagem} />
      </main>
    </>
  );
}
