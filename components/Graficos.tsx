import { fmtAno } from "@/lib/periodos";

type Barra = { rotulo: string; valor: number; destaque?: boolean };
const fmt = (n: number) => n.toLocaleString("pt-BR");

export function Barras({ dados, largura = 640, altura = 230, titulo }: { dados: Barra[]; largura?: number; altura?: number; titulo: string }) {
  if (!dados.length) return null;
  const ml = 56, mb = 30, mt = 18, mr = 10;
  const mx = Math.max(...dados.map((d) => d.valor)) || 1;
  const bruto = mx / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= bruto) || 10 * mag);
  const topo = Math.ceil(mx / passo) * passo;
  const ticks = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const y = (v: number) => altura - mb - (v / topo) * (altura - mb - mt);
  const bw = (largura - ml - mr) / dados.length;
  return (
    <svg width="100%" viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={titulo} style={{ maxWidth: largura }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={ml} x2={largura - mr} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={ml - 6} y={y(t) + 4} fontSize={11} textAnchor="end" style={{ fill: "var(--muted)" }}>{fmt(Math.round(t))}</text>
        </g>
      ))}
      {dados.map((d, i) => {
        const x = ml + i * bw + bw * 0.15, w = bw * 0.7;
        return (
          <g key={i}>
            <rect x={x} y={y(d.valor)} width={w} height={Math.max(0, y(0) - y(d.valor))} rx={3} fill={d.destaque ? "var(--ochre)" : "var(--accent)"}><title>{`${d.rotulo}: ${fmt(d.valor)}`}</title></rect>
            <text x={x + w / 2} y={y(d.valor) - 5} fontSize={10.5} textAnchor="middle" style={{ fill: "var(--muted)" }}>{fmt(d.valor)}</text>
            <text x={x + w / 2} y={altura - 10} fontSize={11} textAnchor="middle">{d.rotulo}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Cronologia({ eventos, chaves, largura = 760 }: { eventos: { ano: number; evento: string; fonte: string }[]; chaves: Record<string, string>; largura?: number }) {
  if (!eventos?.length) return null;
  const ev = [...eventos].sort((a, b) => a.ano - b.ano);
  const lin = 36, H = ev.length * lin + 46, x0 = 30, x1 = largura * 0.42;
  const a0 = ev[0].ano, a1 = ev[ev.length - 1].ano, span = a1 - a0 || 1;
  const x = (a: number) => x0 + ((a - a0) / span) * (x1 - x0);
  return (
    <svg width="100%" viewBox={`0 0 ${largura} ${H}`} role="img" aria-label="Cronologia" style={{ maxWidth: largura }}>
      <line x1={x0} x2={x1} y1={20} y2={20} stroke="var(--line)" strokeWidth={2} />
      {ev.map((e, i) => {
        const yy = 46 + i * lin;
        const txt = `${e.evento} (${chaves[e.fonte] || "fonte"})`;
        return (
          <g key={i}>
            <circle cx={x(e.ano)} cy={20} r={4.5} fill="var(--accent)" />
            <line x1={x(e.ano)} x2={x(e.ano)} y1={24} y2={yy - 4} stroke="var(--line)" />
            <circle cx={x(e.ano)} cy={yy} r={3} fill="var(--ochre)" />
            <text x={x(e.ano) + 10} y={yy + 4} fontSize={12.5}>
              <tspan fontWeight={600}>{fmtAno(e.ano)}</tspan> · {txt.length > 95 ? txt.slice(0, 93) + "…" : txt}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export type GraficosDados = {
  producao: { consulta: string; decadas: { decada: number; total: number }[]; consultadoEm: string } | null;
  fontesPorDecada: { decada: number; total: number }[];
  dados: { titulo: string; unidade: string; serie: { rotulo: string; valor: number }[]; fonte: string; trecho_literal: string }[];
} | null;

/** Lista de figuras com legenda ABNT ("Figura N – título. Fonte: ..."). */
export function figurasDeGraficos(g: GraficosDados, chaves: Record<string, string>) {
  const out: { titulo: string; fonte: string; el: JSX.Element }[] = [];
  if (!g) return out;
  if (g.producao?.decadas?.length) {
    const anoAtual = new Date().getFullYear();
    out.push({
      titulo: `Trabalhos acadêmicos por década sobre “${g.producao.consulta}”`,
      fonte: `OpenAlex (Artes e Humanidades e Ciências Sociais), consulta em ${new Date(g.producao.consultadoEm).toLocaleDateString("pt-BR")}. A última década pode estar incompleta.`,
      el: <Barras titulo="Produção acadêmica" dados={g.producao.decadas.map((d) => ({ rotulo: `${d.decada}s`, valor: d.total, destaque: d.decada + 10 > anoAtual }))} />,
    });
  }
  if (g.fontesPorDecada?.length)
    out.push({ titulo: "Fontes deste nível por década de publicação", fonte: "Elaborado com base nas fontes selecionadas (OpenAlex).", el: <Barras titulo="Fontes por década" altura={190} dados={g.fontesPorDecada.map((d) => ({ rotulo: `${d.decada}s`, valor: d.total }))} /> });
  for (const d of g.dados || [])
    out.push({
      titulo: `${d.titulo}${d.unidade ? ` (${d.unidade})` : ""}`,
      fonte: `${chaves[d.fonte] || "fonte do estudo"}. Trecho conferido: “${d.trecho_literal}”`,
      el: <Barras titulo={d.titulo} dados={d.serie.map((s) => ({ rotulo: s.rotulo, valor: s.valor }))} />,
    });
  return out;
}
