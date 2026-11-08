import { partirCitacoes } from "@/lib/citar";

export type Conteudo = {
  titulo: string;
  abertura: string;
  secoes: { titulo: string; paragrafos: { tipo?: "fonte" | "explicacao"; texto: string; fontes: string[]; citacao: { fonte: string; trecho: string } | null }[] }[];
  conceitos: { termo: string; definicao: string; fontes: string[] }[];
  avisos: string[];
  estatisticas?: { paragrafos: number; comFonte: number; explicativos: number; citacoesDiretas: number };
  palavras: number;
  fontes_usadas: string[];
  buscas: string[];
  modelo?: string;
};

export function Paragrafo({ texto, chaves, aoClicar }: { texto: string; chaves: Record<string, string>; aoClicar?: (id: string) => void }) {
  return (
    <>
      {partirCitacoes(texto, chaves).map((p, i) =>
        p.tipo === "texto" ? (
          <span key={i}>{p.v}</span>
        ) : (
          <span key={i} className="cit">
            {aoClicar ? <>{" "}<button type="button" onClick={() => aoClicar(p.ids[0])} title="Ver a fonte">{p.v.trim()}</button></> : p.v}
          </span>
        )
      )}
    </>
  );
}

/** Citação direta curta, no corpo do texto, com aspas e chamada autor-data (NBR 10520:2023). */
export function CitacaoDireta({ c, chaves }: { c: { fonte: string; trecho: string }; chaves: Record<string, string> }) {
  const longa = c.trecho.split(/\s+/).length > 40;
  return longa ? (
    <blockquote>{c.trecho} ({chaves[c.fonte]})</blockquote>
  ) : (
    <p>Nas palavras da fonte: “{c.trecho.replace(/^["“]|["”]$/g, "")}” ({chaves[c.fonte]}).</p>
  );
}

export default function TextoNivel({ c, chaves, aoClicar, numeracao }: { c: Conteudo; chaves: Record<string, string>; aoClicar?: (id: string) => void; numeracao?: string }) {
  return (
    <article className="prosa">
      <p style={{ fontStyle: "italic", color: "var(--muted)" }}>{c.abertura}</p>
      {c.secoes.map((s, i) => (
        <section key={i}>
          <h3>{numeracao ? `${numeracao}.${i + 1} ` : ""}{s.titulo}</h3>
          {s.paragrafos.map((p, j) => (
            <div key={j}>
              <p className={p.tipo === "explicacao" ? "expl" : undefined} title={p.tipo === "explicacao" ? "Parágrafo explicativo escrito pela IA para ligar as ideias (sem fatos novos)" : undefined}><Paragrafo texto={p.texto} chaves={chaves} aoClicar={aoClicar} /></p>
              {p.citacao && <CitacaoDireta c={p.citacao} chaves={chaves} />}
            </div>
          ))}
        </section>
      ))}
      {!!c.conceitos?.length && (
        <section>
          <h3>{numeracao ? `${numeracao}.${c.secoes.length + 1} ` : ""}Conceitos-chave</h3>
          <dl>
            {c.conceitos.map((k, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <dt style={{ fontWeight: 600 }}>{k.termo}</dt>
                <dd style={{ margin: "2px 0 0 0" }}>{k.definicao} ({k.fontes.map((f) => chaves[f]).filter(Boolean).join("; ")})</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </article>
  );
}
