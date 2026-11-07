// Chamadas à OpenAI com saída estruturada (JSON Schema estrito).
import OpenAI from "openai";

let _c: OpenAI | null = null;
function cliente() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada no servidor.");
  return (_c ||= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, fetch: (...a: Parameters<typeof fetch>) => globalThis.fetch(...a) }));
}
export const MODELO = () => process.env.OPENAI_MODEL || "gpt-4.1";
export const MODELO_RAPIDO = () => process.env.OPENAI_MODEL_RAPIDO || "gpt-4.1-mini";

export async function gerarJSON<T>(opts: {
  sistema: string;
  usuario: string;
  nome: string;
  schema: Record<string, unknown>;
  modelo?: string;
  maxTokens?: number;
  temperatura?: number;
}): Promise<T> {
  const r = await cliente().chat.completions.create({
    model: opts.modelo || MODELO(),
    temperature: opts.temperatura ?? 0.3,
    max_tokens: opts.maxTokens ?? 4000,
    messages: [
      { role: "system", content: opts.sistema },
      { role: "user", content: opts.usuario },
    ],
    response_format: { type: "json_schema", json_schema: { name: opts.nome, strict: true, schema: opts.schema } },
  });
  const c = r.choices[0];
  if (c.finish_reason === "length") throw new Error("A resposta da IA foi cortada por tamanho. Tente gerar de novo.");
  const txt = c.message.content;
  if (!txt) throw new Error(c.message.refusal || "A IA não retornou conteúdo.");
  return JSON.parse(txt) as T;
}

/** Helper para schemas estritos: todos os campos obrigatórios, sem campos extras. */
export function obj(props: Record<string, unknown>) {
  return { type: "object", properties: props, required: Object.keys(props), additionalProperties: false };
}
export const str = { type: "string" };
export const int = { type: "integer" };
export const num = { type: "number" };
export const bool = { type: "boolean" };
export const arr = (items: unknown) => ({ type: "array", items });
export const nullable = (t: { type: string }) => ({ type: [t.type, "null"] });
