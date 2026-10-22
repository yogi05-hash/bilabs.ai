import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { COOKIE } from "@/lib/adminAuth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  void env;
  return res;
}
