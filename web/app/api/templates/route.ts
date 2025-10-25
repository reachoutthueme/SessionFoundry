import { NextResponse } from "next/server";
import { templates } from "./data";

export async function GET() {
  const list = templates.map(t => ({ id: t.id, name: t.name, blurb: t.blurb, activities: t.activities.length }));
  return NextResponse.json({ templates: list });
}

