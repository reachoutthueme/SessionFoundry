import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    hasUrlPublic: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasUrlServer: !!process.env.SUPABASE_URL,
    hasService: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
