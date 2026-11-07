# Atlas Historiográfico

Estudo sistemático de História em 5 níveis, com fontes acadêmicas reais, mapas, gráficos, perguntas, chat e apostila ABNT em PDF.

## Como funciona

1. Na página inicial você escolhe um período (divisões de **Brasil** e **Mundo**) e escreve o tema.
2. O sistema cria uma **pasta de estudo** e gera o **nível 1**. Os níveis seguintes são gerados um por vez, quando você pedir:
   1. Panorama · 2. Processos e estruturas · 3. Fontes e evidências · 4. Debates historiográficos · 5. Fronteiras de pesquisa
3. Para cada nível:
   - **Busca** artigos, livros e capítulos na **OpenAlex** (Artes e Humanidades e Ciências Sociais, só obras com resumo).
   - **Seleciona** as fontes mais relevantes, **confere os metadados** pelo DOI na **Crossref** e **lê o texto completo** quando ele está em acesso aberto.
   - **Escreve** um texto de 3 a 4 páginas (OpenAI) usando **somente** esse material.
   - **Verifica** tudo automaticamente:
     - parágrafo sem fonte é removido;
     - citação direta que não bate letra por letra com a fonte é descartada;
     - data da cronologia que não aparece no texto da fonte é descartada;
     - lugar que não é citado na fonte não vai para o mapa;
     - gráfico de dados só entra se os números estiverem no trecho copiado da fonte.
   - **Monta**:
     - o mapa: país atual + fronteiras de época + lugares localizados pelo OpenStreetMap;
     - os gráficos: produção acadêmica por década (OpenAlex) e fontes por década;
     - as perguntas de revisão.
4. Tudo fica salvo no Supabase: níveis, fontes, perguntas e respostas corrigidas, chat e anotações.
5. **Apostila PDF**:
   - O que tem: capa, sumário, texto com citações autor-data (NBR 10520:2023), figuras e quadros com fonte, questões e referências (NBR 6023:2018).
   - Como salvar: na página da apostila, clique em “Salvar como PDF”.

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pbwqxemonlwzbdksrvok.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave publicável do projeto (está em `.env.example`) |
| `OPENAI_API_KEY` | sua chave da OpenAI |
| `OPENAI_MODEL` | `gpt-4.1` (texto dos níveis e chat) |
| `OPENAI_MODEL_RAPIDO` | `gpt-4.1-mini` (triagem, perguntas, correção) |
| `ALLOWED_EMAILS` | seu e-mail (só ele consegue entrar) |
| `CONTATO_APIS` | seu e-mail (enviado às APIs públicas, boa prática) |
| `AUTOR_NOME` | nome na capa da apostila |

## Depois do primeiro deploy

No Supabase → Authentication → URL Configuration:

- **Site URL:** a URL da Vercel (ex.: `https://atlas-historiografico.vercel.app`).
- **Redirect URLs:** a mesma URL seguida de `/auth/callback`.

Sem esse ajuste, o link de login enviado por e-mail aponta para `localhost`.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha OPENAI_API_KEY e ALLOWED_EMAILS
npm run dev
npm test                     # testes de ABNT, verificação de trechos e do pipeline com APIs simuladas
```

## Créditos das bases

- **Artigos e livros:** OpenAlex e Crossref.
- **Mapas:**
  - países atuais: Natural Earth (via world-atlas);
  - fronteiras de época: [historical-basemaps](https://github.com/aourednik/historical-basemaps) (André Ourednik, GPL-3.0), aproximadas e com nomes em inglês;
  - estados do Brasil: click_that_hood;
  - coordenadas: OpenStreetMap/Nominatim.
