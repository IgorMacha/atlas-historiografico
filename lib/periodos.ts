// As duas divisões históricas usadas como ponto de partida (Brasil e Mundo).
export type Periodo = {
  id: string;
  divisao: "brasil" | "mundo";
  nome: string;
  rotulo: string; // recorte como aparece na tela
  inicio: number; // ano (negativo = a.C.)
  fim: number;
  marcos: string[];
  cor: string; // token de cor do CSS
};

export const PERIODOS_BRASIL: Periodo[] = [
  { id: "br-indigena", divisao: "brasil", nome: "Período Indígena", rotulo: "até 1500", inicio: -12000, fim: 1500, marcos: ["Povos indígenas habitavam o território há milhares de anos", "Diversas culturas e modos de vida"], cor: "--p-verde" },
  { id: "br-colonial", divisao: "brasil", nome: "Período Colonial", rotulo: "1500–1822", inicio: 1500, fim: 1822, marcos: ["1500: chegada dos portugueses", "1532: início do povoamento", "1750: Tratado de Madri"], cor: "--p-laranja" },
  { id: "br-imperial", divisao: "brasil", nome: "Período Imperial", rotulo: "1822–1889", inicio: 1822, fim: 1889, marcos: ["1822: Independência", "1840: consolidação do Império", "1889: Proclamação da República"], cor: "--p-verde" },
  { id: "br-republicano", divisao: "brasil", nome: "Período Republicano", rotulo: "1889–1930", inicio: 1889, fim: 1930, marcos: ["1889: República", "1930: Revolução de 1930"], cor: "--p-azul" },
  { id: "br-vargas", divisao: "brasil", nome: "Era Vargas", rotulo: "1930–1945", inicio: 1930, fim: 1945, marcos: ["1930: Vargas no poder", "1937–1945: Estado Novo"], cor: "--p-lilas" },
  { id: "br-democratico", divisao: "brasil", nome: "Período Democrático", rotulo: "1946–1964", inicio: 1946, fim: 1964, marcos: ["1946: redemocratização", "1964: golpe militar"], cor: "--p-verde" },
  { id: "br-militar", divisao: "brasil", nome: "Regime Militar", rotulo: "1964–1985", inicio: 1964, fim: 1985, marcos: ["1964: início da ditadura militar", "1985: fim do regime"], cor: "--p-ciano" },
  { id: "br-nova-republica", divisao: "brasil", nome: "Nova República", rotulo: "1985–atualidade", inicio: 1985, fim: 2026, marcos: ["1985: redemocratização", "1988: nova Constituição", "Atualidade: desafios e conquistas"], cor: "--p-rosa" },
];

export const PERIODOS_MUNDO: Periodo[] = [
  { id: "mu-pre-historia", divisao: "mundo", nome: "Pré-História", rotulo: "até 3500 a.C.", inicio: -300000, fim: -3500, marcos: ["Surgimento do ser humano", "Primeiras ferramentas e agricultura"], cor: "--p-lilas" },
  { id: "mu-antiguidade", divisao: "mundo", nome: "Antiguidade", rotulo: "3500 a.C.–476", inicio: -3500, fim: 476, marcos: ["Egito, Mesopotâmia, Grécia e Roma", "476: queda do Império Romano do Ocidente"], cor: "--p-verde" },
  { id: "mu-idade-media", divisao: "mundo", nome: "Idade Média", rotulo: "476–1453", inicio: 476, fim: 1453, marcos: ["Feudalismo, Igreja e Cruzadas", "1453: queda de Constantinopla"], cor: "--p-laranja" },
  { id: "mu-idade-moderna", divisao: "mundo", nome: "Idade Moderna", rotulo: "1453–1789", inicio: 1453, fim: 1789, marcos: ["Grandes navegações", "Renascimento", "1789: Revolução Francesa"], cor: "--p-azul" },
  { id: "mu-contemporanea", divisao: "mundo", nome: "Idade Contemporânea", rotulo: "1789–atualidade", inicio: 1789, fim: 2026, marcos: ["Revoluções, industrialização e guerras mundiais", "1945: fim da Segunda Guerra", "Mundo globalizado"], cor: "--p-verde" },
];

export const TODOS_PERIODOS = [...PERIODOS_BRASIL, ...PERIODOS_MUNDO];
export const periodoPorId = (id?: string | null) => TODOS_PERIODOS.find((p) => p.id === id);

export const NIVEIS = [
  { n: 1, nome: "Panorama", foco: "visão geral introdutória: contexto, geografia, cronologia básica, principais sociedades, personagens e conceitos. Linguagem clara para quem está começando a graduação." },
  { n: 2, nome: "Processos e estruturas", foco: "processos de média e longa duração: economia, sociedade, política, cultura e religião, relações de causa e consequência, comparações internas ao tema." },
  { n: 3, nome: "Fontes e evidências", foco: "como sabemos o que sabemos: tipos de fontes primárias e vestígios (documentos, arqueologia, iconografia, cartografia), como os autores das fontes as analisam, limites e métodos de crítica." },
  { n: 4, nome: "Debates historiográficos", foco: "correntes interpretativas, controvérsias, revisões, conceitos disputados e como os autores das fontes se posicionam uns em relação aos outros." },
  { n: 5, nome: "Fronteiras de pesquisa", foco: "agenda de pesquisa recente, lacunas, novas abordagens, problemas de pesquisa possíveis para um trabalho de graduação, recortes, fontes e metodologia." },
] as const;

export const fmtAno = (a: number) => (a < 0 ? `${Math.abs(a).toLocaleString("pt-BR")} a.C.` : String(a));

// Camadas de fronteiras históricas disponíveis em /public/geo (historical-basemaps).
export const BASEMAPS: [number, string][] = [
  [-1000, "world_bc1000"], [-500, "world_bc500"], [-200, "world_bc200"], [-1, "world_bc1"], [400, "world_400"],
  [800, "world_800"], [1000, "world_1000"], [1279, "world_1279"], [1492, "world_1492"], [1530, "world_1530"],
  [1600, "world_1600"], [1700, "world_1700"], [1800, "world_1800"], [1815, "world_1815"], [1880, "world_1880"],
  [1914, "world_1914"], [1938, "world_1938"], [1960, "world_1960"], [1994, "world_1994"],
];
export function basemapMaisProximo(ano: number | null | undefined): string | null {
  if (ano == null || !isFinite(ano)) return null;
  if (ano < -3000) return null; // sem camada confiável para períodos muito antigos
  let best = BASEMAPS[0];
  for (const b of BASEMAPS) if (Math.abs(b[0] - ano) < Math.abs(best[0] - ano)) best = b;
  return best[1];
}
export const rotuloBasemap = (k: string) => {
  const b = BASEMAPS.find((x) => x[1] === k);
  return b ? fmtAno(b[0] === -1 ? -1 : b[0]) : k;
};
