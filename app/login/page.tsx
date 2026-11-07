import { headers } from "next/headers";
import { supabaseServidor } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function entrar(fd: FormData) {
  "use server";
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const permitidos = (process.env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!email || (permitidos.length && !permitidos.includes(email))) redirect("/login?erro=email");
  const h = headers();
  const origem = `${h.get("x-forwarded-proto") || "https"}://${h.get("x-forwarded-host") || h.get("host")}`;
  const { error } = await supabaseServidor().auth.signInWithOtp({ email, options: { emailRedirectTo: `${origem}/auth/callback` } });
  redirect(error ? `/login?erro=envio&m=${encodeURIComponent(error.message)}` : "/login?enviado=1");
}

export default function Login({ searchParams }: { searchParams: Record<string, string> }) {
  const msg =
    searchParams.enviado ? "Enviamos um link de acesso para o seu e-mail. Abra-o neste mesmo navegador."
    : searchParams.erro === "email" ? "Este e-mail não tem acesso ao Atlas."
    : searchParams.erro === "link" ? "O link expirou ou não é válido. Peça um novo."
    : searchParams.erro === "envio" ? `Não foi possível enviar o link: ${searchParams.m || "tente de novo em alguns minutos"}.`
    : null;
  return (
    <main className="pagina" style={{ maxWidth: 460, paddingTop: "12vh" }}>
      <div className="olho">Atlas Historiográfico</div>
      <h1 style={{ marginTop: 6 }}>Entrar</h1>
      <p className="lead" style={{ fontSize: 16 }}>Seus estudos, níveis, perguntas e conversas ficam salvos na sua conta.</p>
      <form action={entrar} className="card sec" style={{ display: "grid", gap: 10 }}>
        <label htmlFor="email" className="small muted">E-mail</label>
        <input id="email" name="email" type="email" required className="campo" placeholder="voce@exemplo.com" autoComplete="email" />
        <button className="btn pri" type="submit">Receber link de acesso</button>
      </form>
      {msg && <p className="aviso sec">{msg}</p>}
    </main>
  );
}
