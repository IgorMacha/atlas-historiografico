import { chavesCitacao, ordenarReferencias, referenciaPartes } from "@/lib/abnt";
import { NIVEIS, periodoPorId, fmtAno } from "@/lib/periodos";
import TextoNivel, { type Conteudo } from "@/components/TextoNivel";
import { figurasDeGraficos } from "@/components/Graficos";
import MapaApostila from "@/components/MapaApostila";
import BotaoImprimir from "@/components/BotaoImprimir";


const CSS = `
.apostila{--bg:#fff;--surface:#fff;--surface-2:#eee;--ink:#111;--muted:#444;--line:#ccc;--accent:#0e6b67;--ochre:#9a6516;--ochre-soft:rgba(176,122,34,.2);--sea:#eef3f5;--land:#e4e8e5;--land-line:#999;--uf-line:#bbb;
  background:#fff;color:#111;font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.5;color-scheme:light}
body:has(.apostila){background:#e9ecee}
.folha{background:#fff;max-width:21cm;margin:16px auto;padding:3cm 2cm 2cm 3cm;box-shadow:0 1px 6px rgba(0,0,0,.12)}
.apostila h1,.apostila h2,.apostila h3{font-family:"Times New Roman",Times,serif;color:#111}
.apostila .prosa{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.5;max-width:none}
.apostila .prosa p{text-indent:1.25cm;text-align:justify;margin:0 0 6pt}
.apostila .prosa p[style]{text-indent:0}
.apostila .prosa h3{font-size:12pt;font-weight:700;margin:18pt 0 6pt;text-transform:none}
.apostila .prosa blockquote{margin:6pt 0 12pt 4cm;padding:0;border:0;font-size:10pt;line-height:1;font-style:normal;text-align:justify}
.apostila .prosa p.expl{border:0;padding-left:0;margin-left:0}
.apostila .prosa .cit{color:#111;white-space:normal}
.apostila .cap{font-size:12pt;font-weight:700;text-transform:uppercase;margin:0 0 18pt}
.capa{display:flex;flex-direction:column;justify-content:space-between;text-align:center;min-height:24cm;text-transform:uppercase;font-weight:700}
.capa .tit{font-size:16pt}
.sumario p{margin:0 0 4pt;text-align:left}.sumario p.sub{padding-left:1cm}
.fig{margin:14pt 0;break-inside:avoid;text-align:center}.fig .leg{font-size:10pt;text-align:center;margin:4pt 0}.fig .fon{font-size:10pt;text-align:left;margin:4pt 0}
.fig svg text{fill:#111!important}
.refs p{text-align:left;text-indent:0;margin:0 0 12pt;line-height:1}
.quadro{width:100%;border-collapse:collapse;font-size:10pt;line-height:1.2}.quadro td,.quadro th{border:1px solid #111;padding:4px 6px;text-align:left;vertical-align:top}
@page{size:A4;margin:3cm 2cm 2cm 3cm}
@media print{body:has(.apostila){background:#fff}.nao-imprimir{display:none!important}.folha{margin:0;padding:0;box-shadow:none;max-width:none}.quebra{break-before:page}.mapabox{border:1px solid #999}}
`;

export function ApostilaDoc({ estudo, niveis, fontes, perguntas, so, autor, imprimir, comPerguntas = true }: { estudo: any; niveis: any[]; fontes: any[]; perguntas: any[]; so: number | null; autor: string; imprimir?: boolean; comPerguntas?: boolean }) {
  const todasFontes = fontes;
  const chaves = chavesCitacao(todasFontes);
  const lv = niveis;
  // Só entram nas referências as fontes citadas nos níveis exportados
  const citadas = new Set<string>();
  for (const l of lv) {
    const c: Conteudo = l.conteudo;
    for (const s of c?.secoes || []) for (const p of s.paragrafos) { p.fontes.forEach((f) => citadas.add(f)); if (p.citacao) citadas.add(p.citacao.fonte); }
    (c?.conceitos || []).forEach((k) => k.fontes.forEach((f) => citadas.add(f)));
    (l.cronologia || []).forEach((e: any) => citadas.add(e.fonte));
    (l.mapa?.lugares || []).forEach((e: any) => citadas.add(e.fonte));
    (l.graficos?.dados || []).forEach((e: any) => citadas.add(e.fonte));
  }
  const refs = ordenarReferencias(todasFontes.filter((f) => citadas.has(f.id)));
  const p = periodoPorId(estudo.periodo);
  const ano = new Date().getFullYear();
  let fig = 0, quadro = 0;

  return (
    <div className="apostila">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <BotaoImprimir auto={imprimir} />
      <div className="folha">
        <section className="capa">
          <div>ATLAS HISTORIOGRÁFICO<br />ESTUDO SISTEMÁTICO DE HISTÓRIA</div>
          <div>{autor}</div>
          <div className="tit">{estudo.titulo}<div style={{ fontSize: "12pt", marginTop: 12 }}>{p ? `${p.nome} (${p.rotulo})` : ""}{so ? ` — Nível ${so}: ${NIVEIS[so - 1].nome}` : " — Níveis 1 a " + (lv.at(-1)?.n ?? 1)}</div></div>
          <div>{ano}</div>
        </section>

        <section className="quebra sumario">
          <p className="cap" style={{ textAlign: "center" }}>SUMÁRIO</p>
          {lv.map((l, i) => (
            <div key={l.id}>
              <p><strong>{i + 1} {(NIVEIS[l.n - 1].nome + ": " + (l.titulo || "")).toUpperCase()}</strong></p>
              {(l.conteudo?.secoes || []).map((s: any, j: number) => <p key={j} className="sub">{i + 1}.{j + 1} {s.titulo}</p>)}
            </div>
          ))}
          <p><strong>REFERÊNCIAS</strong></p>
        </section>

        {lv.map((l, i) => {
          const figs = figurasDeGraficos(l.graficos, chaves);
          const qs = (perguntas || []).filter((x: any) => x.level_id === l.id);
          return (
            <section key={l.id} className="quebra">
              <p className="cap">{i + 1} {NIVEIS[l.n - 1].nome.toUpperCase()}: {String(l.titulo || "").toUpperCase()}</p>
              <TextoNivel c={l.conteudo} chaves={chaves} numeracao={String(i + 1)} />
              {!!l.mapa?.lugares?.length && (
                <div className="fig">
                  <p className="leg">Figura {++fig} – Lugares citados nas fontes do nível {l.n}{l.mapa.basemap ? `, sobre fronteiras aproximadas de ${fmtAno(l.mapa.ano)}` : ""}</p>
                  <MapaApostila dados={l.mapa} brasil={estudo.periodo?.startsWith("br-")} chaves={chaves} />
                  <p className="fon">Fonte: elaborado pelo autor com Natural Earth, historical-basemaps (Ourednik) e OpenStreetMap, a partir de {[...new Set(l.mapa.lugares.map((x: any) => chaves[x.fonte]))].join("; ")}. Legenda: {l.mapa.lugares.map((x: any, k: number) => `${k + 1}. ${x.nome_no_periodo} (hoje ${x.nome_atual}, ${x.pais_atual})`).join("; ")}.</p>
                </div>
              )}
              {!!l.cronologia?.length && (
                <div className="fig">
                  <p className="leg">Quadro {++quadro} – Cronologia do nível {l.n}</p>
                  <table className="quadro"><thead><tr><th>Ano</th><th>Evento</th><th>Fonte</th></tr></thead><tbody>
                    {l.cronologia.map((e: any, k: number) => <tr key={k}><td>{fmtAno(e.ano)}</td><td>{e.evento}</td><td>{chaves[e.fonte]}</td></tr>)}
                  </tbody></table>
                  <p className="fon">Fonte: elaborado pelo autor com base nas fontes indicadas.</p>
                </div>
              )}
              {figs.map((f, k) => (
                <div className="fig" key={k}>
                  <p className="leg">Figura {++fig} – {f.titulo}</p>
                  {f.el}
                  <p className="fon">Fonte: {f.fonte}</p>
                </div>
              ))}
              {comPerguntas && !!qs.length && (
                <div className="prosa">
                  <h3>{i + 1}.{(l.conteudo?.secoes?.length || 0) + 2} Questões de revisão</h3>
                  {qs.map((q: any, k: number) => (
                    <div key={q.id} style={{ marginBottom: 8 }}>
                      <p style={{ textIndent: 0 }}>{k + 1}. {q.enunciado}</p>
                      {q.tipo === "multipla" && (q.opcoes || []).map((o: string, j: number) => <p key={j} style={{ textIndent: 0, marginLeft: "1cm" }}>{String.fromCharCode(97 + j)}) {o}</p>)}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <section className="quebra refs">
          <p className="cap" style={{ textAlign: "center" }}>REFERÊNCIAS</p>
          {refs.map((f: any) => { const r = referenciaPartes(f); return <p key={f.id}>{r.antes}<strong>{r.destaque}</strong>{r.depois}</p>; })}
          {lv.some((l) => l.mapa?.lugares?.length) && <>
          <p>NATURAL EARTH. <strong>Admin 0 – Countries</strong>. 1:50m. [S. l.]: Natural Earth, [s. d.]. Disponível em: https://www.naturalearthdata.com.</p>
          <p>OUREDNIK, André. <strong>historical-basemaps</strong>. [S. l.]: GitHub, [s. d.]. Disponível em: https://github.com/aourednik/historical-basemaps.</p>
          </>}
        </section>
      </div>
    </div>
  );
}
