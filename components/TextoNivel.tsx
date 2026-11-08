import { partirCitacoes } from "@/lib/citar";
import Mapa, { type MapaDados } from "./Mapa";
import { fmtAno } from "@/lib/periodos";

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

/** Mapa logo abaixo da seção, com os lugares que as fontes daquela seção citam. */
function MapaDaSecao({ mapa, secao, chaves, brasil, estatico, legenda }: { mapa: MapaDados; secao: number; chaves: Record<string, string>; brasil?: boolean; estatico?: boolean; legenda?: (lugares: any[]) => React.ReactNode }) {
  const lugares = (mapa?.lugares || []).filter((l) => l.secao === secao);
  if (!mapa || !lugares.length) return null;
  return (
    <figure className={`mapa-secao${estatico ? " fig" : ""}`} style={{ margin: "14px 0 22px" }}>
      {legenda ? legenda(lugares) : <figcaption className="small muted" style={{ marginBottom: 6, fontFamily: "var(--f-ui)" }}>Mapa da seção: {lugares.map((l) => `${l.nome_no_periodo} (hoje ${l.nome_atual}, ${l.pais_atual})`).join("; ")}{mapa.basemap && mapa.ano != null ? ` · fronteiras aproximadas de ${fmtAno(mapa.ano)}` : ""}</figcaption>}
      <Mapa dados={{ ...mapa, lugares }} brasil={brasil} chaves={chaves} compacto estatico={estatico} altura={estatico ? 360 : 340} />
      {estatico && (
        <p className="fon">
          Fonte: elaborado pelo autor com Natural Earth, historical-basemaps (Ourednik) e OpenStreetMap, a partir de {[...new Set(lugares.map((x) => chaves[x.fonte]))].join("; ")}. Legenda: {lugares.map((x, k) => `${k + 1}. ${x.nome_no_periodo} (hoje ${x.nome_atual}, ${x.pais_atual})`).join("; ")}.
        </p>
      )}
    </figure>
  );
}

export default function TextoNivel({ c, chaves, aoClicar, numeracao, mapa, brasil, mapaEstatico, legendaMapa }: { c: Conteudo; chaves: Record<string, string>; aoClicar?: (id: string) => void; numeracao?: string; mapa?: MapaDados; brasil?: boolean; mapaEstatico?: boolean; legendaMapa?: (secao: number, lugares: any[]) => React.ReactNode }) {
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
          {mapa && <MapaDaSecao mapa={mapa} secao={i + 1} chaves={chaves} brasil={brasil} estatico={mapaEstatico} legenda={legendaMapa ? (ls) => legendaMapa(i + 1, ls) : undefined} />}
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
