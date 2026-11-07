"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TextoNivel, { type Conteudo, Paragrafo } from "./TextoNivel";
import Mapa, { type MapaDados } from "./Mapa";
import { Cronologia, figurasDeGraficos, type GraficosDados } from "./Graficos";
import { NIVEIS, periodoPorId } from "@/lib/periodos";
import { chavesCitacao, ordenarReferencias, referenciaPartes, referenciaTexto, type FonteRef } from "@/lib/abnt";
import { concluirNivel, salvarAnotacoes, marcarLida } from "@/app/acoes";
import { supabaseNavegador } from "@/lib/supabase/client";

export type Nivel = { id: string; n: number; status: string; etapa: string | null; titulo: string | null; conteudo: Conteudo | null; mapa: MapaDados; graficos: GraficosDados; cronologia: { ano: number; evento: string; fonte: string }[] | null; erro: string | null; gerado_em: string | null; concluido_em: string | null };
export type Fonte = FonteRef & { tipo: string; resumo: string | null; nivel: number | null; lido: boolean; citacoes: number; tem_texto: boolean; url_oa: string | null; idioma: string | null };
export type Pergunta = { id: string; level_id: string; ordem: number; tipo: "multipla" | "aberta"; enunciado: string; opcoes: string[] | null; gabarito: string; explicacao: string | null; fontes: string[]; resposta: string | null; feedback: string | null; nota: number | null };
export type Mensagem = { id: string; role: "user" | "assistant"; conteudo: string; fontes: { ids?: string[]; sem_base?: boolean } | null; created_at: string };
type Estudo = { id: string; titulo: string; tema: string; periodo: string | null; nivel_atual: number; anotacoes: string | null; created_at: string };

const ABAS = [["texto", "Texto"], ["mapa", "Mapa"], ["graficos", "Gráficos e cronologia"], ["perguntas", "Perguntas"], ["chat", "Chat"], ["fontes", "Fontes"], ["notas", "Anotações"]] as const;
type Aba = (typeof ABAS)[number][0];

function useToast() {
  const [m, setM] = useState<string | null>(null);
  const t = useRef<any>();
  const show = (s: string) => { setM(s); clearTimeout(t.current); t.current = setTimeout(() => setM(null), 2400); };
  return { el: m ? <div className="toast" role="status">{m}</div> : null, show };
}

export default function Pasta({ estudo, niveis: niveis0, fontes: fontes0, perguntas: perg0, mensagens: msg0 }: { estudo: Estudo; niveis: Nivel[]; fontes: Fonte[]; perguntas: Pergunta[]; mensagens: Mensagem[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [niveis, setNiveis] = useState(niveis0);
  const [fontes, setFontes] = useState(fontes0);
  const [perguntas, setPerguntas] = useState(perg0);
  const [msgs, setMsgs] = useState(msg0);
  const [sel, setSel] = useState<number>(() => {
    const prontos = niveis0.filter((l) => l.status === "pronto" || l.status === "gerando").map((l) => l.n);
    return Math.min(estudo.nivel_atual, prontos.length ? Math.max(...prontos) : 1) || 1;
  });
  const [aba, setAba] = useState<Aba>("texto");
  const [focoFonte, setFocoFonte] = useState<string | null>(null);
  const toast = useToast();
  const p = periodoPorId(estudo.periodo);

  useEffect(() => setNiveis(niveis0), [niveis0]);
  useEffect(() => setFontes(fontes0), [fontes0]);
  useEffect(() => setPerguntas(perg0), [perg0]);

  const chaves = useMemo(() => chavesCitacao(fontes), [fontes]);
  const nivel = niveis.find((l) => l.n === sel);
  const gerando = niveis.some((l) => l.status === "gerando");

  // Acompanha a geração em segundo plano
  useEffect(() => {
    if (!gerando) return;
    const sb = supabaseNavegador();
    const t = setInterval(async () => {
      const { data } = await sb.from("levels").select("id,n,status,etapa,erro").eq("study_id", estudo.id);
      if (!data) return;
      setNiveis((old) => old.map((l) => { const d = data.find((x: any) => x.n === l.n); return d ? { ...l, ...d } : l; }));
      if (data.every((x: any) => x.status !== "gerando")) router.refresh();
    }, 3500);
    return () => clearInterval(t);
  }, [gerando, estudo.id, router]);

  const gerar = useCallback(async (n: number) => {
    setNiveis((old) => (old.some((l) => l.n === n) ? old.map((l) => (l.n === n ? { ...l, status: "gerando", etapa: "Iniciando", erro: null } : l)) : [...old, { id: "", n, status: "gerando", etapa: "Iniciando", titulo: null, conteudo: null, mapa: null, graficos: null, cronologia: null, erro: null, gerado_em: null, concluido_em: null }]));
    setSel(n);
    setAba("texto");
    const r = await fetch(`/api/estudos/${estudo.id}/niveis/${n}`, { method: "POST" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setNiveis((old) => old.map((l) => (l.n === n ? { ...l, status: "erro", erro: j.erro || "Falha ao iniciar." } : l)));
    }
  }, [estudo.id]);

  // Primeiro nível automático ao criar a pasta
  const iniciou = useRef(false);
  useEffect(() => {
    if (sp.get("gerar") && !iniciou.current && !niveis0.length) { iniciou.current = true; gerar(1); router.replace(`/estudo/${estudo.id}`); }
  }, [sp, niveis0.length, gerar, estudo.id, router]);

  const verFonte = (id: string) => { setFocoFonte(id); setAba("fontes"); };
  const pergNivel = perguntas.filter((q) => q.level_id === nivel?.id).sort((a, b) => a.ordem - b.ordem);
  const respondidas = perguntas.filter((q) => q.resposta != null);
  const media = respondidas.length ? respondidas.reduce((s, q) => s + Number(q.nota || 0), 0) / respondidas.length : null;

  return (
    <div className="estudo">
      <aside className="lateral" aria-label="Níveis do estudo">
        <div className="olho">{p ? `${p.divisao === "brasil" ? "Brasil" : "Mundo"} · ${p.nome}` : "Tema livre"}</div>
        <h1 style={{ fontSize: 26 }}>{estudo.titulo}</h1>
        <div className="kpis" style={{ gridTemplateColumns: "1fr 1fr", margin: "8px 0" }}>
          <div className="kpi"><b>{fontes.length}</b><span>fontes</span></div>
          <div className="kpi"><b>{media == null ? "–" : media.toFixed(1)}</b><span>média nas perguntas</span></div>
        </div>
        {NIVEIS.map((nv) => {
          const l = niveis.find((x) => x.n === nv.n);
          const anteriorPronto = nv.n === 1 || niveis.find((x) => x.n === nv.n - 1)?.status === "pronto";
          const cls = l?.concluido_em ? "feito" : l?.status === "pronto" ? "pronto" : "";
          return (
            <button key={nv.n} type="button" className={`nv ${cls} ${sel === nv.n ? "on" : ""}`} disabled={!l && !anteriorPronto} onClick={() => { setSel(nv.n); if (aba === "fontes" || aba === "notas" || aba === "chat") setAba("texto"); }}>
              <b>{l?.concluido_em ? "✓" : nv.n}</b>
              <span>{nv.nome}<small>{l?.status === "gerando" ? "gerando…" : l?.status === "erro" ? "erro, tente de novo" : l?.status === "pronto" ? (l.concluido_em ? "concluído" : "pronto para estudar") : anteriorPronto ? "disponível para gerar" : "bloqueado"}</small></span>
            </button>
          );
        })}
        <div className="linha sec" style={{ marginTop: 14 }}>
          <a className="btn sm" href={`/estudo/${estudo.id}/apostila`} target="_blank" rel="noopener">Apostila PDF (tudo)</a>
          {nivel?.status === "pronto" && <a className="btn sm" href={`/estudo/${estudo.id}/apostila?n=${sel}`} target="_blank" rel="noopener">PDF do nível {sel}</a>}
        </div>
      </aside>

      <section style={{ minWidth: 0 }}>
        <div className="abas" role="tablist">
          {ABAS.map(([k, nome]) => (
            <button key={k} role="tab" aria-selected={aba === k} className={aba === k ? "on" : ""} onClick={() => setAba(k)}>{nome}{k === "perguntas" && pergNivel.length ? ` (${pergNivel.filter((q) => q.resposta != null).length}/${pergNivel.length})` : ""}</button>
          ))}
        </div>

        {["texto", "mapa", "graficos", "perguntas"].includes(aba) && (
          <EstadoNivel nivel={nivel} n={sel} gerar={gerar} podeGerar={sel === 1 || niveis.find((x) => x.n === sel - 1)?.status === "pronto"} />
        )}

        {aba === "texto" && nivel?.status === "pronto" && nivel.conteudo && (
          <div className="sec">
            <div className="olho">Nível {sel} de 5 · {NIVEIS[sel - 1].nome} · cerca de {nivel.conteudo.palavras} palavras</div>
            <h2 style={{ margin: "4px 0 14px" }}>{nivel.conteudo.titulo}</h2>
            {!!nivel.conteudo.avisos?.length && <div className="aviso forte" style={{ marginBottom: 16 }}>{nivel.conteudo.avisos.map((a, i) => <div key={i}>{a}</div>)}</div>}
            <TextoNivel c={nivel.conteudo} chaves={chaves} aoClicar={verFonte} />
            <div className="sec linha">
              <button className={`btn ${nivel.concluido_em ? "" : "pri"}`} onClick={async () => { await concluirNivel(estudo.id, sel, !nivel.concluido_em); setNiveis((o) => o.map((l) => (l.n === sel ? { ...l, concluido_em: l.concluido_em ? null : new Date().toISOString() } : l))); toast.show(nivel.concluido_em ? "Nível reaberto" : `Nível ${sel} concluído`); router.refresh(); }}>
                {nivel.concluido_em ? "✓ Concluído (reabrir)" : `Concluir nível ${sel}`}
              </button>
              <button className="btn" onClick={() => setAba("perguntas")}>Responder perguntas</button>
              {sel < 5 && !niveis.find((l) => l.n === sel + 1) && <button className="btn" disabled={gerando} onClick={() => gerar(sel + 1)}>Gerar nível {sel + 1} →</button>}
              {sel < 5 && niveis.find((l) => l.n === sel + 1) && <button className="btn" onClick={() => setSel(sel + 1)}>Ir para o nível {sel + 1} →</button>}
            </div>
            <p className="small muted sec">Texto escrito por IA ({nivel.conteudo.modelo}) somente a partir das fontes listadas, com citações e datas conferidas automaticamente contra o resumo ou o texto completo de cada fonte. Buscas feitas: {nivel.conteudo.buscas.join(" · ")}.</p>
          </div>
        )}

        {aba === "mapa" && nivel?.status === "pronto" && (
          <div className="sec">
            <Mapa dados={nivel.mapa} brasil={estudo.periodo?.startsWith("br-")} chaves={chaves} />
            <div className="sec">
              <div className="rot">Lugares citados: nome no período e localização atual</div>
              {nivel.mapa?.lugares?.length ? (
                <div className="rolar"><table className="tab"><thead><tr><th>#</th><th>No período</th><th>Hoje</th><th>Papel no tema</th><th>Fonte</th></tr></thead><tbody>
                  {nivel.mapa.lugares.map((l, i) => <tr key={i}><td>{i + 1}</td><td>{l.nome_no_periodo}</td><td>{l.nome_atual}, {l.pais_atual}</td><td>{l.papel}</td><td><button className="btn sm" onClick={() => verFonte(l.fonte)}>{chaves[l.fonte]}</button></td></tr>)}
                </tbody></table></div>
              ) : <p className="muted">As fontes deste nível não citam lugares que pudessem ser conferidos e localizados.</p>}
              <p className="small muted">Mapa atual: Natural Earth. Fronteiras de época: historical-basemaps (A. Ourednik). Coordenadas: OpenStreetMap/Nominatim. Só aparecem lugares cujo nome consta no texto da fonte indicada.</p>
            </div>
          </div>
        )}

        {aba === "graficos" && nivel?.status === "pronto" && (
          <div className="sec">
            <div className="rot">Cronologia (anos conferidos no texto das fontes)</div>
            {nivel.cronologia?.length ? <div className="grafico"><Cronologia eventos={nivel.cronologia} chaves={chaves} /></div> : <p className="muted">Nenhuma data pôde ser conferida nas fontes deste nível.</p>}
            {figurasDeGraficos(nivel.graficos, chaves).map((f, i) => (
              <div className="sec" key={i}>
                <div className="rot">{f.titulo}</div>
                <div className="grafico">{f.el}</div>
                <p className="small muted">Fonte: {f.fonte}</p>
              </div>
            ))}
          </div>
        )}

        {aba === "perguntas" && nivel?.status === "pronto" && <Perguntas lista={pergNivel} chaves={chaves} atualizar={(q) => setPerguntas((o) => o.map((x) => (x.id === q.id ? q : x)))} />}
        {aba === "chat" && <Chat estudoId={estudo.id} msgs={msgs} setMsgs={setMsgs} chaves={chaves} verFonte={verFonte} aoAdicionar={() => router.refresh()} toast={toast.show} />}
        {aba === "fontes" && <Fontes fontes={fontes} chaves={chaves} foco={focoFonte} setFontes={setFontes} toast={toast.show} />}
        {aba === "notas" && <Notas estudo={estudo} />}
      </section>
      {toast.el}
    </div>
  );
}

function EstadoNivel({ nivel, n, gerar, podeGerar }: { nivel?: Nivel; n: number; gerar: (n: number) => void; podeGerar: boolean }) {
  if (nivel?.status === "pronto") return null;
  if (nivel?.status === "gerando")
    return (
      <div className="card sec">
        <div className="etapa"><div className="giro" /><div><b>Gerando o nível {n}: {NIVEIS[n - 1].nome}</b><div className="muted small">{nivel.etapa || "Trabalhando…"}</div></div></div>
        <p className="small muted" style={{ marginBottom: 0 }}>Leva de 2 a 5 minutos. Você pode sair desta página: a geração continua e fica salva na pasta.</p>
      </div>
    );
  return (
    <div className="card sec">
      {nivel?.status === "erro" && <p className="aviso forte" style={{ marginTop: 0 }}>A geração falhou: {nivel.erro}</p>}
      <h2>Nível {n}: {NIVEIS[n - 1].nome}</h2>
      <p className="muted">{NIVEIS[n - 1].foco}</p>
      <button className="btn pri" disabled={!podeGerar} onClick={() => gerar(n)}>{nivel?.status === "erro" ? "Tentar de novo" : `Gerar nível ${n}`}</button>
      {!podeGerar && <p className="small muted">Gere o nível anterior primeiro.</p>}
    </div>
  );
}

function Perguntas({ lista, chaves, atualizar }: { lista: Pergunta[]; chaves: Record<string, string>; atualizar: (q: Pergunta) => void }) {
  const [rasc, setRasc] = useState<Record<string, string>>({});
  const [env, setEnv] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const responder = async (q: Pergunta, resposta: string) => {
    setEnv(q.id); setErro(null);
    const r = await fetch(`/api/perguntas/${q.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resposta }) });
    const j = await r.json().catch(() => ({}));
    setEnv(null);
    if (!r.ok) return setErro(j.erro || "Falha ao enviar.");
    atualizar(j);
  };
  if (!lista.length) return <p className="muted sec">Este nível não tem perguntas.</p>;
  return (
    <div className="grade sec">
      {erro && <p className="aviso forte">{erro}</p>}
      {lista.map((q, i) => (
        <div className="perg" key={q.id}>
          <div className="linha entre"><span className="pill">{q.tipo === "multipla" ? "Múltipla escolha" : "Dissertativa"}</span>{q.nota != null && <span className={`pill ${Number(q.nota) >= 6 ? "ok" : "er"}`}>Nota {Number(q.nota).toFixed(1)}</span>}</div>
          <p style={{ fontWeight: 600, margin: "8px 0" }}>{i + 1}. {q.enunciado}</p>
          {q.tipo === "multipla" ? (
            <>
              {(q.opcoes || []).map((o, j) => {
                const respondida = q.resposta != null;
                const cls = respondida ? (String(j) === q.gabarito ? "certa" : String(j) === q.resposta ? "errada" : "") : "";
                return <button key={j} className={`opt ${cls}`} disabled={respondida || env === q.id} onClick={() => responder(q, String(j))}>{String.fromCharCode(97 + j)}) {o}</button>;
              })}
            </>
          ) : q.resposta != null ? (
            <div className="feedback" style={{ borderLeftColor: "var(--line)" }}><b>Sua resposta:</b>{"\n"}{q.resposta}</div>
          ) : (
            <>
              <label htmlFor={`r-${q.id}`} className="small muted">Sua resposta</label>
              <textarea id={`r-${q.id}`} className="campo" value={rasc[q.id] || ""} onChange={(e) => setRasc({ ...rasc, [q.id]: e.target.value })} />
              <button className="btn pri" style={{ marginTop: 8 }} disabled={!rasc[q.id]?.trim() || env === q.id} onClick={() => responder(q, rasc[q.id])}>{env === q.id ? "Corrigindo…" : "Enviar para correção"}</button>
            </>
          )}
          {q.feedback && <div className="feedback">{q.feedback}</div>}
          {q.resposta != null && q.tipo === "aberta" && <details style={{ marginTop: 8 }}><summary className="small">Ver resposta esperada</summary><div className="feedback" style={{ borderLeftColor: "var(--ochre)" }}>{q.gabarito}</div></details>}
          {q.resposta != null && !!q.fontes?.length && <p className="small muted">Base: {q.fontes.map((f) => chaves[f]).filter(Boolean).join("; ")}</p>}
        </div>
      ))}
    </div>
  );
}

function Chat({ estudoId, msgs, setMsgs, chaves, verFonte, aoAdicionar, toast }: { estudoId: string; msgs: Mensagem[]; setMsgs: (f: (m: Mensagem[]) => Mensagem[]) => void; chaves: Record<string, string>; verFonte: (id: string) => void; aoAdicionar: () => void; toast: (s: string) => void }) {
  const [txt, setTxt] = useState("");
  const [ocupado, setOcupado] = useState<"" | "chat" | "busca">("");
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => fim.current?.scrollIntoView({ block: "end" }), [msgs.length]);
  const enviar = async (pergunta: string) => {
    setOcupado("chat"); setErro(null);
    const tmp: Mensagem = { id: "tmp" + Date.now(), role: "user", conteudo: pergunta, fontes: null, created_at: new Date().toISOString() };
    setMsgs((m) => [...m, tmp]); setTxt("");
    const r = await fetch(`/api/estudos/${estudoId}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pergunta }) });
    const j = await r.json().catch(() => ({}));
    setOcupado("");
    if (!r.ok) { setErro(j.erro || "Falha no chat."); return; }
    setMsgs((m) => [...m, { id: "a" + Date.now(), role: "assistant", conteudo: j.resposta, fontes: { ids: j.fontes, sem_base: j.sem_base }, created_at: new Date().toISOString() }]);
  };
  const buscar = async (consulta: string) => {
    setOcupado("busca"); setErro(null);
    const r = await fetch(`/api/estudos/${estudoId}/fontes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consulta }) });
    const j = await r.json().catch(() => ({}));
    setOcupado("");
    if (!r.ok) return setErro(j.erro || "Falha na busca.");
    toast(j.adicionadas ? `${j.adicionadas} fonte(s) adicionada(s) à pasta` : "Nenhuma fonte nova relevante encontrada");
    if (j.adicionadas) aoAdicionar();
  };
  const ultimaPergunta = [...msgs].reverse().find((m) => m.role === "user")?.conteudo;
  return (
    <div className="sec">
      <p className="small muted">O chat responde só com as fontes desta pasta e os textos dos níveis. Se elas não cobrirem a pergunta, ele avisa e você pode buscar fontes novas.</p>
      <div className="chat">
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            {m.role === "assistant" ? <Paragrafo texto={m.conteudo} chaves={chaves} aoClicar={verFonte} /> : m.conteudo}
            {m.role === "assistant" && m.fontes?.sem_base && ultimaPergunta && (
              <div style={{ marginTop: 8 }}><button className="btn sm" disabled={!!ocupado} onClick={() => buscar(ultimaPergunta)}>{ocupado === "busca" ? "Buscando na OpenAlex…" : "Buscar fontes novas sobre isso"}</button></div>
            )}
          </div>
        ))}
        {ocupado === "chat" && <div className="msg assistant"><span className="giro" style={{ display: "inline-block", verticalAlign: "middle" }} /> Consultando as fontes…</div>}
        <div ref={fim} />
      </div>
      {erro && <p className="aviso forte">{erro}</p>}
      <form className="linha sec" onSubmit={(e) => { e.preventDefault(); if (txt.trim()) enviar(txt.trim()); }}>
        <label htmlFor="chat" className="small muted" style={{ width: "100%" }}>Pergunte sobre o estudo</label>
        <input id="chat" className="campo" style={{ flex: 1, minWidth: 0 }} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Ex.: Qual a diferença entre as interpretações apresentadas no nível 4?" maxLength={2000} />
        <button className="btn pri" disabled={!txt.trim() || !!ocupado}>Enviar</button>
      </form>
    </div>
  );
}

function Fontes({ fontes, chaves, foco, setFontes, toast }: { fontes: Fonte[]; chaves: Record<string, string>; foco: string | null; setFontes: (f: (x: Fonte[]) => Fonte[]) => void; toast: (s: string) => void }) {
  const refEl = useRef<HTMLDivElement>(null);
  useEffect(() => { if (foco) document.getElementById(`f-${foco}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [foco]);
  const ord = ordenarReferencias(fontes);
  const copiar = async (t: string) => { try { await navigator.clipboard.writeText(t); toast("Copiado"); } catch { toast("Selecione e copie manualmente"); } };
  return (
    <div className="sec" ref={refEl}>
      <div className="linha entre">
        <span className="small muted">{fontes.length} fontes · {fontes.filter((f) => f.lido).length} lidas · {fontes.filter((f) => f.tem_texto).length} com texto completo lido pelo sistema</span>
        <button className="btn sm" onClick={() => copiar(ord.map(referenciaTexto).join("\n\n"))}>Copiar referências ABNT</button>
      </div>
      <div className="grade sec">
        {ord.map((f) => {
          const pr = referenciaPartes(f);
          return (
            <div key={f.id} id={`f-${f.id}`} className={`fonte ${f.lido ? "lida" : ""}`} style={foco === f.id ? { boxShadow: "0 0 0 2px var(--accent)" } : undefined}>
              <div className="linha entre">
                <span className="linha"><span className="pill oc">{f.tipo === "book" ? "Livro" : f.tipo === "book-chapter" ? "Capítulo" : "Artigo"}</span><span className="pill">{chaves[f.id]}</span>{f.nivel ? <span className="pill">nível {f.nivel}</span> : <span className="pill">adicionada pelo chat</span>}{f.tem_texto && <span className="pill ok">texto completo lido</span>}</span>
                <span className="small muted">{f.citacoes} citações (OpenAlex)</span>
              </div>
              <div className="ref">{pr.antes}<strong>{pr.destaque}</strong>{pr.depois}</div>
              {f.resumo && <details><summary className="small">Resumo</summary><div className="resumo">{f.resumo}</div></details>}
              <div className="linha">
                {f.doi && <a className="btn sm" href={`https://doi.org/${f.doi}`} target="_blank" rel="noopener">Abrir pelo DOI</a>}
                {f.url_oa && <a className="btn sm" href={f.url_oa} target="_blank" rel="noopener">Texto em acesso aberto</a>}
                <button className="btn sm" onClick={async () => { await marcarLida(f.id, !f.lido); setFontes((x) => x.map((y) => (y.id === f.id ? { ...y, lido: !y.lido } : y))); }}>{f.lido ? "✓ Lida" : "Marcar como lida"}</button>
                <button className="btn sm" onClick={() => copiar(referenciaTexto(f))}>Copiar ABNT</button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="aviso sec">Referências no padrão ABNT NBR 6023:2018, montadas com metadados da OpenAlex e da Crossref. Quando a base não informa o local de publicação, aparece [s. l.]; complete consultando a fonte.</p>
    </div>
  );
}

function Notas({ estudo }: { estudo: Estudo }) {
  const [v, setV] = useState(estudo.anotacoes || "");
  const [st, setSt] = useState("Salvo automaticamente na sua conta.");
  const t = useRef<any>();
  return (
    <div className="sec">
      <label htmlFor="notas" className="small muted">Leituras, páginas, dúvidas e ideias deste estudo.</label>
      <textarea id="notas" className="campo" style={{ minHeight: 320 }} value={v} onChange={(e) => { setV(e.target.value); clearTimeout(t.current); setSt("Salvando…"); t.current = setTimeout(async () => { await salvarAnotacoes(estudo.id, e.target.value); setSt("Salvo às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })); }, 700); }} />
      <p className="small muted">{st}</p>
    </div>
  );
}
