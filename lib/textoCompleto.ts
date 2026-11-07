// Tenta obter o texto completo de fontes em acesso aberto (PDF ou HTML), para aprofundar o estudo além do resumo.
import { htmlParaTexto } from "./texto";

const CONTATO = process.env.CONTATO_APIS || "";
const UA = `Mozilla/5.0 (compatible; AtlasHistoriografico/1.0${CONTATO ? `; mailto:${CONTATO}` : ""})`;
const LIMITE = 120_000;

async function lerPdf(buf: Buffer): Promise<string> {
  const pdf = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const r = await pdf(buf, { max: 60 });
  return r.text;
}

export async function obterTextoCompleto(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 18000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/pdf,text/html;q=0.9,*/*;q=0.5" }, redirect: "follow", signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) return null;
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const len = Number(r.headers.get("content-length") || 0);
    if (len > 25_000_000) return null;
    let texto = "";
    if (ct.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
      texto = await lerPdf(Buffer.from(await r.arrayBuffer()));
    } else if (ct.includes("html") || ct.includes("xml")) {
      const html = await r.text();
      // SciELO e muitos periódicos OJS publicam o corpo do artigo em <article> ou div de texto
      const m = html.match(/<article[\s\S]*?<\/article>/i) || html.match(/<div[^>]+(articleText|article-body|fulltext|ArticleText)[\s\S]*$/i);
      texto = htmlParaTexto(m ? m[0] : html);
    } else return null;
    texto = texto.replace(/\u0000/g, "").trim();
    if (texto.length < 3000) return null; // provavelmente só a página de resumo
    return texto.slice(0, LIMITE);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
