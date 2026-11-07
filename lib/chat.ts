// Chat do estudo (só com as fontes da pasta) e correção de respostas abertas.
import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarJSON, MODELO_RAPIDO, obj, str, arr, bool, num } from "./ia";
import { materialDasFontes, type FonteDB } from "./pipeline";
import { termos } from "./texto";

const SISTEMA_CHAT = `Você é o orientador de estudos de um aluno de graduação em História no Brasil. Responda em português do Brasil.
Use SOMENTE o material das fontes [S#] e os textos dos níveis fornecidos. Não acrescente fatos, datas, nomes ou números que não estejam ali.
Marque cada afirmação com a fonte, ex.: [S2]. Não escreva nomes de autores com ano entre parênteses; o sistema converte os marcadores para ABNT.
Se o material não permite responder (total ou parcialmente), diga isso com clareza e marque "sem_base" como true. Não tente completar com conhecimento geral.`;

export async function responderChat(sb: SupabaseClient, studyId: string, pergunta: string) {
  const [{ data: estudo }, { data: fontes }, { data: niveis }, { data: hist }] = await Promise.all([
    sb.from("studies").select("*").eq("id", studyId).single(),
    sb.from("sources").select("*").eq("study_id", studyId),
    sb.from("levels").select("n,titulo,conteudo").eq("study_id", studyId).eq("status", "pronto").order("n"),
    sb.from("messages").select("role,conteudo").eq("study_id", studyId).order("created_at", { ascending: false }).limit(8),
  ]);
  if (!estudo) throw new Error("Estudo não encontrado.");
  const fs = (fontes || []) as FonteDB[];
  if (!fs.length) return { resposta: "Este estudo ainda não tem fontes. Gere o primeiro nível ou busque fontes antes de perguntar.", fontes: [], sem_base: true };

  // escolhe as fontes mais relacionadas à pergunta
  const q = new Set(termos(`${pergunta} ${estudo.tema}`));
  const ranqueadas = fs
    .map((f) => ({ f, s: termos(`${f.titulo} ${f.resumo || ""} ${(f.texto_completo || "").slice(0, 20000)}`).filter((t) => q.has(t)).length }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 10)
    .map((x) => x.f);
  const mat = materialDasFontes(ranqueadas, pergunta, 60_000);
  const resumoNiveis = (niveis || [])
    .map((l: any) => `Nível ${l.n} — ${l.titulo}\n` + (l.conteudo?.secoes || []).map((s: any) => `${s.titulo}: ${s.paragrafos.map((p: any) => p.texto.replace(/\[\[[0-9a-f-]+\]\]/g, "")).join(" ").slice(0, 900)}`).join("\n"))
    .join("\n\n")
    .slice(0, 20000);
  const historico = (hist || []).reverse().map((m: any) => `${m.role === "user" ? "Aluno" : "Orientador"}: ${m.conteudo.replace(/\[\[[0-9a-f-]+\]\]/g, "")}`).join("\n").slice(-6000);

  const r = await gerarJSON<{ resposta: string; fontes: string[]; sem_base: boolean }>({
    nome: "chat",
    maxTokens: 2500,
    sistema: SISTEMA_CHAT,
    usuario: `Tema do estudo: ${estudo.tema}\n\nCONVERSA ANTERIOR:\n${historico || "(início)"}\n\nTEXTOS DOS NÍVEIS:\n${resumoNiveis || "(nenhum nível pronto)"}\n\nMATERIAL DAS FONTES:\n${mat.texto}\n\nPERGUNTA DO ALUNO: ${pergunta}`,
    schema: obj({ resposta: str, fontes: arr(str), sem_base: bool }),
  });
  const idDe = (rr: string) => mat.porRotulo[rr.replace(/[\[\]\s]/g, "")]?.id;
  const resposta = r.resposta.replace(/\[(S\d+)\]/g, (m, rr) => (idDe(rr) ? `[[${idDe(rr)}]]` : ""));
  const ids = [...new Set([...r.fontes.map(idDe), ...[...r.resposta.matchAll(/\[(S\d+)\]/g)].map((m) => idDe(m[1]))].filter(Boolean))] as string[];
  return { resposta, fontes: ids, sem_base: r.sem_base };
}

export async function corrigirAberta(enunciado: string, esperada: string, resposta: string, material: string) {
  return gerarJSON<{ nota: number; feedback: string; acertos: string[]; faltou: string[] }>({
    modelo: MODELO_RAPIDO(),
    nome: "correcao",
    maxTokens: 1200,
    sistema: "Você corrige respostas dissertativas de História (graduação) com justiça e de forma construtiva, em português do Brasil. Baseie-se apenas na resposta esperada e no material fornecido.",
    usuario: `PERGUNTA: ${enunciado}\n\nRESPOSTA ESPERADA: ${esperada}\n\nMATERIAL DE APOIO:\n${material.slice(0, 12000)}\n\nRESPOSTA DO ALUNO: ${resposta}\n\nDê nota de 0 a 10, um feedback de 3 a 6 frases, os pontos que o aluno acertou e o que faltou.`,
    schema: obj({ nota: num, feedback: str, acertos: arr(str), faltou: arr(str) }),
  });
}
