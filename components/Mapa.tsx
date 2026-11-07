"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import { BASEMAPS, rotuloBasemap, fmtAno } from "@/lib/periodos";

export type Lugar = { nome_no_periodo: string; nome_atual: string; pais_atual: string; papel: string; fonte: string; lat: number; lon: number };
export type MapaDados = { basemap: string | null; ano: number | null; lugares: Lugar[] } | null;

// Bases cartográficas abertas servidas por CDN (jsDelivr):
// países atuais: Natural Earth via world-atlas; UFs: click_that_hood; fronteiras de época: historical-basemaps (A. Ourednik).
const URLS: Record<string, string> = {
  atual: "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json",
  br_ufs: "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/brazil-states.geojson",
};
const urlDe = (n: string) => URLS[n] || `https://cdn.jsdelivr.net/gh/aourednik/historical-basemaps@master/geojson/${n}.geojson`;

/** O d3 exige anéis no sentido horário; se um polígono "cobre o mundo todo", invertemos seus anéis. */
function rebobinar(fc: any) {
  const fix = (poly: number[][][]) => (d3.geoArea({ type: "Polygon", coordinates: poly } as any) > 2 * Math.PI ? poly.map((r) => [...r].reverse()) : poly);
  for (const f of fc.features || []) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") g.coordinates = fix(g.coordinates);
    else if (g.type === "MultiPolygon") g.coordinates = g.coordinates.map(fix);
  }
  fc.features = (fc.features || []).filter((f: any) => f.geometry);
  return fc;
}

const cache: Record<string, Promise<any>> = {};
const geo = (n: string) =>
  (cache[n] ||= fetch(urlDe(n))
    .then((r) => { if (!r.ok) throw new Error("mapa indisponível"); return r.json(); })
    .then((j) => (j.type === "Topology" ? feature(j, j.objects.countries) : j))
    .then(rebobinar));

/** Mapa atual (Natural Earth) + fronteiras de época (historical-basemaps) + lugares citados nas fontes. */
export default function Mapa({ dados, brasil, chaves, estatico = false, altura }: { dados: MapaDados; brasil?: boolean; chaves: Record<string, string>; estatico?: boolean; altura?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [camada, setCamada] = useState<string | null>(dados?.basemap ?? null);
  const zoomRef = useRef<{ home: () => void; zin: () => void; zout: () => void } | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const el = box.current!, svgEl = svgRef.current!;
      const W = el.clientWidth || 800, H = el.clientHeight || 480;
      const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`);
      svg.selectAll("*").remove();
      const proj = d3.geoNaturalEarth1().scale(W / 6.2).translate([W / 2, H / 2]);
      const path = d3.geoPath(proj);
      const g = svg.append("g");
      g.append("path").datum({ type: "Sphere" } as any).attr("d", path as any).attr("fill", "var(--sea)");
      g.append("path").datum(d3.geoGraticule10()).attr("d", path as any).attr("fill", "none").attr("stroke", "var(--line)").attr("stroke-width", 0.4).attr("vector-effect", "non-scaling-stroke");
      const [atual, ufs, hist] = await Promise.all([geo("atual"), brasil ? geo("br_ufs").catch(() => null) : null, camada ? geo(camada).catch(() => null) : null]);
      if (!vivo) return;
      const showTip = (ev: any, html: string) => {
        const r = el.getBoundingClientRect(), t = tip.current!;
        t.innerHTML = html; t.style.left = Math.min(ev.clientX - r.left + 12, W - 270) + "px"; t.style.top = ev.clientY - r.top + 12 + "px"; t.style.opacity = "1";
      };
      const hide = () => tip.current && (tip.current.style.opacity = "0");
      g.append("g").selectAll("path").data(atual.features).join("path").attr("d", path as any).attr("fill", "var(--land)").attr("stroke", "var(--land-line)").attr("stroke-width", 0.6).attr("vector-effect", "non-scaling-stroke")
        .on("mousemove", (ev: any, d: any) => showTip(ev, `<b>Hoje:</b> ${d.properties.name}`)).on("mouseleave", hide);
      if (ufs) g.append("g").selectAll("path").data(ufs.features).join("path").attr("d", path as any).attr("fill", "none").attr("stroke", "var(--uf-line)").attr("stroke-width", 0.5).attr("vector-effect", "non-scaling-stroke");
      const gh = g.append("g");
      let feats: any[] = [];
      if (hist) {
        feats = hist.features.filter((f: any) => f.properties?.NAME?.trim());
        feats.forEach((f) => (f._a = path.area(f)));
        gh.selectAll("path").data(feats).join("path").attr("d", path as any).attr("fill", "var(--ochre-soft)").attr("stroke", "var(--ochre)").attr("stroke-width", 0.8).attr("vector-effect", "non-scaling-stroke")
          .on("mousemove", (ev: any, d: any) => showTip(ev, `<b>Em ${rotuloBasemap(camada!)}:</b> ${d.properties.NAME}${d.properties.SUBJECTO && d.properties.SUBJECTO !== d.properties.NAME ? `<br>parte de: ${d.properties.SUBJECTO}` : ""}`)).on("mouseleave", hide);
      }
      const ghl = gh.append("g").selectAll("text").data(feats.filter((f) => f._a > 30)).join("text")
        .attr("transform", (d: any) => `translate(${path.centroid(d)})`).attr("text-anchor", "middle").text((d: any) => d.properties.NAME)
        .attr("font-style", "italic").style("fill", "var(--ochre)").style("paint-order", "stroke").style("stroke", "var(--surface)").style("pointer-events", "none");
      const lugares = dados?.lugares || [];
      const pts = g.append("g").selectAll("g").data(lugares).join("g").attr("transform", (d) => `translate(${proj([d.lon, d.lat])})`).style("cursor", "pointer")
        .on("mousemove", (ev: any, d) => showTip(ev, `<b>${d.nome_no_periodo}</b><br>Hoje: ${d.nome_atual}, ${d.pais_atual}<br><span style="opacity:.8">${d.papel}</span><br><span style="opacity:.8">(${chaves[d.fonte] || "fonte"})</span>`)).on("mouseleave", hide);
      const pc = pts.append("circle").attr("fill", "var(--accent)").attr("stroke", "var(--surface)");
      const pl = pts.append("text").text((d, i) => `${i + 1}. ${d.nome_no_periodo.length > 30 ? d.nome_no_periodo.slice(0, 28) + "…" : d.nome_no_periodo}`)
        .style("fill", "var(--ink)").style("paint-order", "stroke").style("stroke", "var(--surface)").style("pointer-events", "none");
      const escala = (k: number) => {
        pc.attr("r", 5.5 / k).attr("stroke-width", 1.5 / k);
        pl.attr("x", 8 / k).attr("y", 4 / k).attr("font-size", 11 / k).style("stroke-width", 3 / k + "px");
        ghl.attr("font-size", 10 / k).style("stroke-width", 2.5 / k + "px").style("display", (d: any) => (d._a * k * k > 900 ? null : "none"));
      };
      // enquadramento: lugares, ou o mundo
      let t0 = d3.zoomIdentity;
      if (lugares.length) {
        const xs = lugares.map((l) => proj([l.lon, l.lat])!);
        const [x0, x1] = d3.extent(xs, (p) => p[0]) as [number, number];
        const [y0, y1] = d3.extent(xs, (p) => p[1]) as [number, number];
        const k = Math.max(1, Math.min(lugares.length === 1 ? 10 : 40, 0.7 / Math.max((x1 - x0 + 30) / W, (y1 - y0 + 30) / H)));
        t0 = d3.zoomIdentity.translate(W / 2 - ((x0 + x1) / 2) * k, H / 2 - ((y0 + y1) / 2) * k).scale(k);
      }
      if (estatico) {
        g.attr("transform", t0.toString());
        escala(t0.k);
        return;
      }
      const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([1, 60]).on("zoom", (ev) => { g.attr("transform", ev.transform.toString()); escala(ev.transform.k); });
      svg.call(zoom as any);
      svg.call(zoom.transform as any, t0);
      zoomRef.current = {
        home: () => svg.transition().duration(450).call(zoom.transform as any, t0),
        zin: () => svg.transition().call(zoom.scaleBy as any, 1.6),
        zout: () => svg.transition().call(zoom.scaleBy as any, 1 / 1.6),
      };
    })();
    return () => { vivo = false; };
  }, [camada, dados, brasil, chaves, estatico]);

  return (
    <div>
      {!estatico && (
        <div className="linha" style={{ margin: "0 0 10px" }}>
          <span className="small muted">Fronteiras de época:</span>
          <div className="anos">
            <button type="button" className={!camada ? "on" : ""} onClick={() => setCamada(null)}>Só mapa atual</button>
            {BASEMAPS.map(([, k]) => (
              <button type="button" key={k} className={camada === k ? "on" : ""} onClick={() => setCamada(k)}>{rotuloBasemap(k)}</button>
            ))}
          </div>
        </div>
      )}
      <div className="mapabox" ref={box} style={altura ? { height: altura, minHeight: altura } : undefined}>
        <svg ref={svgRef} role="img" aria-label="Mapa com lugares do estudo" />
        {!estatico && (
          <div className="zoomb">
            <button type="button" aria-label="Aproximar" onClick={() => zoomRef.current?.zin()}>+</button>
            <button type="button" aria-label="Afastar" onClick={() => zoomRef.current?.zout()}>−</button>
            <button type="button" aria-label="Recentralizar" onClick={() => zoomRef.current?.home()}>⌖</button>
          </div>
        )}
        <div className="legenda">
          <span><i style={{ background: "var(--land)", border: "1px solid var(--land-line)" }} />Países atuais</span>
          {camada && <span><i style={{ background: "var(--ochre-soft)", border: "1px solid var(--ochre)" }} />Fronteiras em {rotuloBasemap(camada)} (aprox.)</span>}
          {!!dados?.lugares?.length && <span><i style={{ background: "var(--accent)", borderRadius: "50%", width: 10 }} />Lugar citado nas fontes</span>}
        </div>
        <div className="dica" ref={tip} />
      </div>
      {dados?.ano != null && !estatico && <p className="small muted">Ano de referência sugerido para este nível: {fmtAno(dados.ano)}. A base de fronteiras históricas é aproximada e usa nomes em inglês.</p>}
    </div>
  );
}

export { BASEMAPS };
