import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
export async function POST(req: Request) {
  await supabaseServidor().auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
