import { cookies } from "next/headers";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export type AuthedUser = { id: string; email?: string | null; plan: "free" | "pro" } | null;

export async function getUserFromRequest(req: Request): Promise<AuthedUser> {
  try {
    // 1) Authorization: Bearer <token>
    const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    let token = "";
    if (auth.toLowerCase().startsWith("bearer ")) token = auth.slice(7).trim();
    // 2) Cookie
    if (!token) {
      const c = await cookies();
      token = c.get("sf_at")?.value || "";
    }
    if (!token) return null;
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    const u = data.user;
    const plan = ((u.user_metadata as any)?.plan as string) === "pro" ? "pro" : "free";
    return { id: u.id, email: u.email, plan };
  } catch {
    return null;
  }
}

