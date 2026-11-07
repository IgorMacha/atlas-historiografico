// Utilidades de texto: normalização, verificação literal de trechos e seleção de passagens relevantes.

export function normalizar(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/-\s*\n\s*/g, "") // hifenização de fim de linha em PDFs
    .replace(/[“”«»"„]/g, '"')
    .replace(/[‘’`´]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** O trecho aparece literalmente (ignorando acentos, pontuação e espaços) no texto da fonte? */
export function trechoConfere(trecho: string, texto: string): boolean {
  const t = normalizar(trecho);
  if (t.length < 20) return false;
  return normalizar(texto).includes(t);
}

/** Todos os números do trecho (ex.: 1.500, 3,5) aparecem nele e o valor informado aparece no trecho? */
export function numeroNoTrecho(valor: number, trecho: string): boolean {
  const nums = (trecho.match(/\d[\d.,]*/g) || []).map((x) => {
    const limpo = x.replace(/[.,]$/, "");
    const semMilhar = limpo.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    return Number(semMilhar);
  });
  return nums.some((n) => Math.abs(n - valor) < 1e-9);
}

const STOP = new Set(
  "a o as os um uma uns umas de da do das dos em no na nos nas por para com sem sob sobre entre e ou que se como mais menos muito ja ao aos à às é ser foi são era the of and in to for on with by from as at an is are was were this that la el los las del y en con por para un una se lo su sus".split(" ")
);
export function termos(s: string): string[] {
  return normalizar(s)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export function dividirEmTrechos(texto: string, tamanho = 1200): string[] {
  const limpo = texto.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  const frases = limpo.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú"“(])/);
  const out: string[] = [];
  let cur = "";
  for (const f of frases) {
    if ((cur + " " + f).length > tamanho && cur.length > 200) {
      out.push(cur.trim());
      cur = f;
    } else cur = cur ? cur + " " + f : f;
  }
  if (cur.trim().length > 80) out.push(cur.trim());
  return out;
}

/** Escolhe os trechos mais relacionados aos termos da consulta (contagem de termos, com bônus por diversidade). */
export function melhoresTrechos(texto: string, consulta: string, k = 4, tamanho = 1200): string[] {
  const q = new Set(termos(consulta));
  if (!q.size) return dividirEmTrechos(texto, tamanho).slice(0, k);
  const pedacos = dividirEmTrechos(texto, tamanho);
  const pont = pedacos.map((p, i) => {
    const ts = termos(p);
    let s = 0;
    const vistos = new Set<string>();
    for (const t of ts) if (q.has(t)) { s += 1; vistos.add(t); }
    return { i, p, score: s / Math.sqrt(ts.length + 20) + vistos.size * 0.6 };
  });
  return pont
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.p);
}

export function htmlParaTexto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h\d|li|tr|section)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
}
