import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseServidor() {
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* chamado de Server Component: o middleware renova a sessão */
        }
      },
    },
  });
}

export async function usuarioAtual() {
  const sb = supabaseServidor();
  const { data } = await sb.auth.getUser();
  return { sb, user: data.user };
}
