import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/supabase/server";
import { buscarObras, enriquecerCrossref } from "@/lib/openalex";
import { obterTextoCompleto } from "@/lib/textoCompleto";
import { referenciaTexto } from "@/lib/abnt";
import { gerarJSON, MODELO_RAPIDO, obj, arr, int, str } from "@/lib/ia";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

/** Busca fontes novas para uma pergunta que as fontes do estudo não cobrem e as adiciona à pasta. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { sb, user } = await usuarioAtual();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  const { consulta } = await req.json().catch(() => ({}));
  if (!consulta || typeof consulta !== "string") return NextResponse.json({ erro: "Informe o que buscar." }, { status: 400 });
  const { data: estudo } = await sb.from("studies").select("*").eq("id", params.id).single();
  if (!estudo) return NextResponse.json({ erro: "Estudo não encontrado." }, { status: 404 });
  try {
    const plano = await gerarJSON<{ buscas: string[] }>({
      modelo: MODELO_RAPIDO(), nome: "buscas", maxTokens: 300,
      sistema: "Você cria consultas curtas para busca de artigos acadêmicos de História.",
      usuario: `Tema do estudo: ${estudo.tema}. Pergunta do aluno: ${consulta}. Gere 3 consultas de 2 a 6 palavras (português, inglês, espanhol).`,
      schema: obj({ buscas: arr(str) }),
    });
    const vistos = new Map<string, any>();
    for (const r of await Promise.allSettled(plano.buscas.slice(0, 3).map((q) => buscarObras(q, 12))))
      if (r.status === "fulfilled") for (const c of r.value) if ((c.resumo?.length || 0) > 200) vistos.set(c.openalex_id, c);
    const { data: ja } = await sb.from("sources").select("openalex_id").eq("study_id", estudo.id);
    const existentes = new Set((ja || []).map((x: any) => x.openalex_id));
    const cands = [...vistos.values()].filter((c) => !existentes.has(c.openalex_id)).slice(0, 36);
    if (!cands.length) return NextResponse.json({ adicionadas: 0 });
    const tri = await gerarJSON<{ selecionadas: { indice: number; motivo: string }[] }>({
      modelo: MODELO_RAPIDO(), nome: "triagem", maxTokens: 800,
      sistema: "Selecione bibliografia acadêmica de História com rigor, descartando o que está fora do tema.",
      usuario: `Tema: ${estudo.tema}\nPergunta: ${consulta}\nEscolha até 5 trabalhos diretamente úteis.\n\n${cands.map((c, i) => `[${i}] ${c.titulo} (${c.ano})\n${(c.resumo || "").slice(0, 400)}`).join("\n\n")}`,
      schema: obj({ selecionadas: arr(obj({ indice: int, motivo: str })) }),
    });
    const esc = await Promise.all(tri.selecionadas.map((s) => cands[s.indice]).filter(Boolean).slice(0, 5).map(enriquecerCrossref));
    const textos = await Promise.all(esc.map((c) => obterTextoCompleto(c.url_oa)));
    if (esc.length) {
      const { error } = await sb.from("sources").upsert(
        esc.map((c, i) => ({ ...c, study_id: estudo.id, user_id: user.id, texto_completo: textos[i], abnt: referenciaTexto({ id: c.openalex_id, ...c }), nivel: null })),
        { onConflict: "study_id,openalex_id" }
      );
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ adicionadas: esc.length, titulos: esc.map((c) => c.titulo) });
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message || "Falha na busca." }, { status: 500 });
  }
}
