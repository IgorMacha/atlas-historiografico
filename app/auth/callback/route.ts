import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const sb = supabaseServidor();
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    const permitidos = (process.env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!error && data.user && (!permitidos.length || permitidos.includes((data.user.email || "").toLowerCase())))
      return NextResponse.redirect(new URL("/", url));
    await sb.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login?erro=link", url));
}
