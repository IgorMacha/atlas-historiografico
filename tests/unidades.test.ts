import { test } from "node:test";
import assert from "node:assert/strict";
import { nomeABNT, chavesCitacao, referenciaTexto, capitalizar } from "../lib/abnt";
import { trechoConfere, numeroNoTrecho, melhoresTrechos } from "../lib/texto";
import { partirCitacoes, textoPlano } from "../lib/citar";
import { basemapMaisProximo } from "../lib/periodos";

test("nomes no formato ABNT", () => {
  assert.equal(nomeABNT("Jorge Pimentel Cintra"), "CINTRA, Jorge Pimentel");
  assert.equal(nomeABNT("Hilário Franco Júnior"), "FRANCO JÚNIOR, Hilário");
  assert.equal(nomeABNT("Resende, Maria Leônia Chaves de"), "RESENDE, Maria Leônia Chaves de");
  assert.equal(capitalizar("SILVA DA COSTA"), "Silva da Costa");
});

test("referência de artigo ABNT", () => {
  const r = referenciaTexto({ id: "a", tipo: "article", titulo: "Reconstruindo o mapa das capitanias hereditárias", autores: ["CINTRA, Jorge Pimentel"], ano: 2013, revista: "Anais do Museu Paulista", local: "São Paulo", volume: "21", numero: "2", paginas: "11-45", doi: "10.1590/s0101-47142013000200002" });
  assert.equal(r, "CINTRA, Jorge Pimentel. Reconstruindo o mapa das capitanias hereditárias. Anais do Museu Paulista, São Paulo, v. 21, n. 2, p. 11-45, 2013. DOI: https://doi.org/10.1590/s0101-47142013000200002.");
});

test("chaves de citação com letras para mesmo autor e ano, et al. com 4+", () => {
  const k = chavesCitacao([
    { id: "1", titulo: "B", autores: ["CINTRA, Jorge"], ano: 2013 },
    { id: "2", titulo: "A", autores: ["CINTRA, Jorge"], ano: 2013 },
    { id: "3", titulo: "C", autores: ["ARAUJO, A", "PUGLIESE JR., F", "SANTOS, R", "OKUMURA, M"], ano: 2017 },
    { id: "4", titulo: "D", autores: ["FUNARI, P", "GARRAFFONI, R"], ano: 2019 },
  ]);
  assert.equal(k["2"], "Cintra, 2013a");
  assert.equal(k["1"], "Cintra, 2013b");
  assert.equal(k["3"], "Araujo et al., 2017");
  assert.equal(k["4"], "Funari; Garraffoni, 2019");
});

test("trecho literal confere ignorando acentos e pontuação, rejeita paráfrase", () => {
  const fonte = "Neste artigo, analisa-se o mapa clássico das capitanias hereditárias da América Portuguesa.";
  assert.ok(trechoConfere("analisa-se o mapa classico das capitanias hereditarias", fonte));
  assert.ok(!trechoConfere("analisa o mapa tradicional das capitanias", fonte));
  assert.ok(!trechoConfere("mapa", fonte));
});

test("números conferidos no trecho", () => {
  assert.ok(numeroNoTrecho(1500, "cerca de 1.500 engenhos em 1630"));
  assert.ok(numeroNoTrecho(3.5, "taxa de 3,5 por cento"));
  assert.ok(!numeroNoTrecho(2000, "cerca de 1.500 engenhos"));
});

test("citações agrupadas no texto", () => {
  const a = "11111111-1111-1111-1111-111111111111", b = "22222222-2222-2222-2222-222222222222";
  const t = `O mapa foi revisto [[${a}]][[${b}]]. Outra frase [[${a}]].`;
  assert.equal(textoPlano(t, { [a]: "Cintra, 2013", [b]: "Abreu, 2009" }), "O mapa foi revisto (Cintra, 2013; Abreu, 2009). Outra frase (Cintra, 2013).");
  assert.equal(partirCitacoes(t, {}).filter((p) => p.tipo === "cit").length, 0);
});

test("seleção de trechos e camada de mapa", () => {
  const txt = Array.from({ length: 30 }, (_, i) => (i === 17 ? "As capitanias hereditárias e os donatários dividiram o litoral. " : "Texto genérico sobre outra coisa qualquer. ")).join("");
  const r = melhoresTrechos(txt, "capitanias donatários", 1, 200);
  assert.ok(r[0].includes("capitanias"));
  assert.equal(basemapMaisProximo(1540), "world_1530");
  assert.equal(basemapMaisProximo(-5000), null);
});
