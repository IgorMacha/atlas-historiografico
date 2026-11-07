import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";

const permitidos = () => (process.env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const liberado = (email: string) => !permitidos().length || permitidos().includes(email);

async function entrar(fd: FormData) {
  "use server";
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const senha = String(fd.get("senha") || "");
  if (!email || !liberado(email)) redirect("/login?erro=email");
  const { error } = await supabaseServidor().auth.signInWithPassword({ email, password: senha });
  if (error) redirect("/login?erro=senha");
  redirect("/");
}

async function criarSenha(fd: FormData) {
  "use server";
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const senha = String(fd.get("senha") || "");
  const conf = String(fd.get("confirmar") || "");
  if (!email || !liberado(email)) redirect("/login?modo=criar&erro=email");
  if (senha.length < 8) redirect("/login?modo=criar&erro=curta");
  if (senha !== conf) redirect("/login?modo=criar&erro=diferentes");
  const sb = supabaseServidor();
  const { data, error } = await sb.rpc("definir_senha_inicial", { p_email: email, p_senha: senha });
  if (error) redirect(`/login?modo=criar&erro=falha&m=${encodeURIComponent(error.message)}`);
  if (!data) redirect("/login?erro=jadefinida");
  const r = await sb.auth.signInWithPassword({ email, password: senha });
  if (r.error) redirect("/login?erro=senha");
  redirect("/");
}

const MSG: Record<string, string> = {
  email: "Este e-mail não tem acesso ao Atlas.",
  senha: "E-mail ou senha incorretos.",
  curta: "A senha precisa ter pelo menos 8 caracteres.",
  diferentes: "As duas senhas não são iguais.",
  jadefinida: "A senha deste e-mail já foi criada. Entre com ela abaixo.",
  falha: "Não foi possível criar a senha.",
};

export default function Login({ searchParams }: { searchParams: Record<string, string> }) {
  const criar = searchParams.modo === "criar";
  const erro = searchParams.erro ? `${MSG[searchParams.erro] || "Algo deu errado."}${searchParams.m ? ` (${searchParams.m})` : ""}` : null;
  return (
    <main className="pagina" style={{ maxWidth: 460, paddingTop: "10vh" }}>
      <div className="olho">Atlas Historiográfico</div>
      <h1 style={{ marginTop: 6 }}>{criar ? "Criar senha" : "Entrar"}</h1>
      <p className="lead" style={{ fontSize: 16 }}>
        {criar ? "Primeiro acesso: defina a senha que você vai usar para entrar." : "Seus estudos, níveis, perguntas e conversas ficam salvos na sua conta."}
      </p>
      {erro && <p className="aviso forte sec">{erro}</p>}
      <form action={criar ? criarSenha : entrar} className="card sec" style={{ display: "grid", gap: 10 }}>
        <label htmlFor="email" className="small muted">E-mail</label>
        <input id="email" name="email" type="email" required className="campo" autoComplete="email" />
        <label htmlFor="senha" className="small muted">{criar ? "Nova senha (mínimo 8 caracteres)" : "Senha"}</label>
        <input id="senha" name="senha" type="password" required minLength={criar ? 8 : undefined} className="campo" autoComplete={criar ? "new-password" : "current-password"} />
        {criar && (
          <>
            <label htmlFor="confirmar" className="small muted">Repita a senha</label>
            <input id="confirmar" name="confirmar" type="password" required minLength={8} className="campo" autoComplete="new-password" />
          </>
        )}
        <button className="btn pri" type="submit">{criar ? "Criar senha e entrar" : "Entrar"}</button>
      </form>
      <p className="small muted sec">
        {criar ? <a href="/login">Já tenho senha</a> : <>Primeiro acesso? <a href="/login?modo=criar">Criar minha senha</a></>}
      </p>
    </main>
  );
}
