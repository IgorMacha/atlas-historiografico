"use client";
import { useState } from "react";
import { PERIODOS_BRASIL, PERIODOS_MUNDO, type Periodo } from "@/lib/periodos";
import { criarEstudo } from "@/app/acoes";

const SUGESTOES: Record<string, string[]> = {
  "br-indigena": ["Povos tupi do litoral", "Sambaquis e ocupação do litoral", "Primeiros povoamentos e a Serra da Capivara"],
  "br-colonial": ["Capitanias hereditárias", "Escravidão africana e tráfico atlântico", "Mineração em Minas Gerais"],
  "br-imperial": ["Independência do Brasil", "Revoltas regenciais", "Abolição da escravidão"],
  "br-republicano": ["Coronelismo na Primeira República", "Guerra de Canudos", "Revolta da Vacina"],
  "br-vargas": ["Estado Novo", "Trabalhismo e CLT", "Revolução Constitucionalista de 1932"],
  "br-democratico": ["Governo JK e desenvolvimentismo", "Reformas de base de João Goulart", "Suicídio de Vargas e a crise de 1954"],
  "br-militar": ["AI-5 e repressão", "Milagre econômico", "Lei de Anistia de 1979"],
  "br-nova-republica": ["Constituinte de 1987-1988", "Diretas Já", "Plano Real"],
  "mu-pre-historia": ["Revolução neolítica", "Arte rupestre", "Povoamento da América"],
  "mu-antiguidade": ["Egito antigo", "Democracia ateniense", "Império Romano"],
  "mu-idade-media": ["Feudalismo", "Cruzadas", "Al-Andalus"],
  "mu-idade-moderna": ["Grandes navegações", "Renascimento", "Reforma protestante"],
  "mu-contemporanea": ["Revolução Francesa", "Revolução Industrial", "Segunda Guerra Mundial"],
};

function Coluna({ titulo, cls, lista, sel, setSel, contagem }: { titulo: string; cls: string; lista: Periodo[]; sel: string | null; setSel: (s: string) => void; contagem: Record<string, number> }) {
  return (
    <section className={`divisao ${cls}`}>
      <header>{titulo}</header>
      {lista.map((p) => (
        <button key={p.id} type="button" className={`periodo ${sel === p.id ? "on" : ""}`} style={{ background: `var(${p.cor})` }} onClick={() => setSel(p.id)} aria-pressed={sel === p.id}>
          <span><b>{p.nome}</b><small>{p.rotulo}</small></span>
          <ul>{p.marcos.map((m) => <li key={m}>{m}</li>)}</ul>
          <span className="n">{contagem[p.id] ? `${contagem[p.id]} estudo(s)` : "Estudar →"}</span>
        </button>
      ))}
      <div className="faixa" aria-hidden="true">
        {lista.filter((_, i) => cls === "mu" || [0, 1, 2, 3].includes(i)).map((p, i) => (
          <div key={p.id} style={{ background: `var(${p.cor})` }}>
            {cls === "br" && i === 3 ? "Republicano" : p.nome.replace("Período ", "")}<br /><small>{cls === "br" && i === 3 ? "1889–atual" : p.rotulo}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function NovoEstudo({ contagem }: { contagem: Record<string, number> }) {
  const [sel, setSel] = useState<string | null>(null);
  const [tema, setTema] = useState("");
  const p = [...PERIODOS_BRASIL, ...PERIODOS_MUNDO].find((x) => x.id === sel);
  return (
    <>
      <div className="divisoes">
        <Coluna titulo="Períodos Históricos do Brasil" cls="br" lista={PERIODOS_BRASIL} sel={sel} setSel={(s) => { setSel(s); setTema(""); }} contagem={contagem} />
        <Coluna titulo="Períodos Históricos do Mundo" cls="mu" lista={PERIODOS_MUNDO} sel={sel} setSel={(s) => { setSel(s); setTema(""); }} contagem={contagem} />
      </div>
      <form action={criarEstudo} className="card sec" id="novo" style={{ display: "grid", gap: 10 }}>
        <div className="olho">Novo estudo</div>
        <h2>{p ? `${p.nome} · ${p.rotulo}` : "Escolha um período acima ou escreva um tema livre"}</h2>
        <input type="hidden" name="periodo" value={sel || ""} />
        <label htmlFor="tema" className="small muted">O que você quer estudar{p ? " dentro deste período" : ""}?</label>
        <input id="tema" name="tema" className="campo" required maxLength={300} value={tema} onChange={(e) => setTema(e.target.value)} placeholder={p ? `Ex.: ${(SUGESTOES[p.id] || [p.nome])[0]}` : "Ex.: História antiga do Mediterrâneo"} />
        {p && (
          <div className="linha">
            <button type="button" className="btn sm" onClick={() => setTema(p.nome)}>{p.nome} (visão geral)</button>
            {(SUGESTOES[p.id] || []).map((s) => <button key={s} type="button" className="btn sm" onClick={() => setTema(s)}>{s}</button>)}
          </div>
        )}
        <div className="linha entre">
          <span className="small muted">O nível 1 começa a ser gerado assim que a pasta for criada (leva de 2 a 4 minutos).</span>
          <button className="btn pri" type="submit">Criar pasta de estudo</button>
        </div>
      </form>
    </>
  );
}
