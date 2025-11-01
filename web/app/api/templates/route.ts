import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { templates } from "./data";

// Let Next.js statically cache this for 5 minutes
export const revalidate = 300;

type PublicTemplate = {
  id: string;
  name: string;
  blurb: string;
  activities: number;
};

export async function GET(_req: NextRequest) {
  const list: PublicTemplate[] = templates.map(t => ({
    id: t.id,
    name: t.name,
    blurb: t.blurb,
    activities: t.activities.length,
  }));

  // Build the JSON once so we can set simple ETag/size headers
  const body = JSON.stringify({ templates: list });

  // Super-light ETag (good enough since data is in-repo)
  const etag = `W/"${body.length}-${templates.length}"`;

  const res = new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Clients and CDNs can cache for 5 minutes; SWR for 30 minutes
      "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
      ETag: etag,
    },
  });

  return res;
}