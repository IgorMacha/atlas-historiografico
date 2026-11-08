// Plano de ensino do estudo: a "trilha" dos 5 níveis, com seções em ordem didática.
// É gerado uma vez por estudo e guia tanto as buscas de fontes quanto a escrita de cada nível.
import type { SupabaseClient } from "@supabase/supabase-js";
import { NIVEIS, periodoPorId } from "./periodos";
import { gerarJSON, obj, str, int, arr, nullable } from "./ia";

export type SecaoPlano = { titulo: string; pergunta_guia: string; conteudos: string[]; buscas: string[] };
export type NivelPlano = { n: number; titulo: string; objetivo: string; ano_referencia_mapa: number | null; secoes: SecaoPlano[] };
export type PlanoEnsino = { visao_geral: string; fio_condutor: string; niveis: NivelPlano[]; gerado_em?: string };

export async function gerarPlanoDeEnsino(sb: SupabaseClient, estudo: { id: string; tema: string; periodo: string | null }): Promise<PlanoEnsino> {
  const p = periodoPorId(estudo.periodo);
  const periodo = p ? `${p.nome} (${p.rotulo}), ${p.divisao === "brasil" ? "História do Brasil" : "História Geral"}` : "recorte livre";
  const plano = await gerarJSON<PlanoEnsino>({
    nome: "plano_de_ensino",
    maxTokens: 6000,
    temperatura: 0.3,
    sistema:
      "Você é um professor universitário de História no Brasil que desenha trilhas de estudo para a graduação. Você organiza o conteúdo com lógica de ensino: do mais básico ao mais complexo, respeitando a ordem cronológica dentro de cada nível e construindo cada nível sobre o anterior.",
    usuario: `Tema: ${estudo.tema}
Período: ${periodo}

Monte o plano de ensino completo do tema em 5 níveis, com esta progressão:
${NIVEIS.map((n) => `- Nível ${n.n} (${n.nome}): ${n.foco}`).join("\n")}

Regras de lógica de ensino:
- O nível 1 começa pelo começo: onde e quando o tema surge, o ambiente geográfico, as condições que permitiram o surgimento, os primeiros momentos, e segue a cronologia até o fim do recorte. Ex.: num estudo sobre os sumérios, comece pela ocupação da Baixa Mesopotâmia e o surgimento das primeiras aldeias e cidades, depois a escrita, as cidades-Estado, até o declínio.
- Cada nível seguinte aprofunda o anterior (estruturas, depois fontes, depois debates, depois pesquisa) sem repetir.
- Cada nível tem de 4 a 6 seções em ordem lógica. Cada seção tem: título claro, uma pergunta-guia que o aluno deve conseguir responder ao final, 3 a 5 conteúdos que a seção precisa cobrir, e 3 consultas curtas (2 a 6 palavras) para buscar bibliografia acadêmica sobre aquela seção: uma em português, uma em inglês e uma em português ou espanhol, com termos que historiadores usam em títulos e resumos.
- "ano_referencia_mapa": um ano representativo do nível para mostrar fronteiras de época (negativo para a.C.), ou null.
- "visao_geral": 3 a 4 frases sobre o que o aluno vai aprender. "fio_condutor": 1 a 2 frases sobre a lógica que liga os 5 níveis.`,
    schema: obj({
      visao_geral: str,
      fio_condutor: str,
      niveis: arr(
        obj({
          n: int,
          titulo: str,
          objetivo: str,
          ano_referencia_mapa: nullable(int),
          secoes: arr(obj({ titulo: str, pergunta_guia: str, conteudos: arr(str), buscas: arr(str) })),
        })
      ),
    }),
  });
  plano.niveis = [1, 2, 3, 4, 5].map((n, i) => ({ ...(plano.niveis.find((x) => x.n === n) || plano.niveis[i]), n }));
  plano.gerado_em = new Date().toISOString();
  const { error } = await sb.from("studies").update({ plano }).eq("id", estudo.id);
  if (error) throw new Error("Erro ao salvar o plano de ensino: " + error.message);
  return plano;
}
