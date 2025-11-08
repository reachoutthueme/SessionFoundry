"use client";

import { useMemo } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";

type Sess = { id: string; name: string; status: string; created_at: string };
type Stats = { participants: number; brainstorm: number; stocktake: number };

export default function SuggestedActions({ sessions, stats }: { sessions: Sess[]; stats: Stats }) {
  const router = useRouter();
  const suggestions = useMemo(() => {
    const inactive = sessions.filter((s) => {
      const st = (s.status || "").toLowerCase();
      return st === "inactive" || st === "draft";
    });
    const none = sessions.length === 0;
    const items: { title: string; desc: string; action?: { label: string; href: string } }[] = [];
    if (none) {
      items.push({
        title: "Create your first session",
        desc: "Start a workshop from a ready-made template.",
        action: { label: "Browse templates", href: "/templates" },
      });
    } else if (inactive.length > 0) {
      const s = inactive[0];
      items.push({
        title: "Apply a template",
        desc: `Session "${s.name}" has no activity yet. Add a template to get moving.`,
        action: { label: "Open session", href: `/session/${s.id}` },
      });
    }
    if (stats.participants === 0 && sessions.length > 0) {
      items.push({
        title: "Invite participants",
        desc: "Share the join code to start collecting input.",
        action: { label: "View sessions", href: "/sessions" },
      });
    }
    return items.slice(0, 3);
  }, [sessions, stats]);

  if (suggestions.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Suggested next steps" subtitle="Based on your recent activity" />
      <CardBody className="p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((s, i) => (
            <div key={i} className="rounded-md border border-white/10 bg-white/5 p-3">
              <div className="text-[13px] font-medium">{s.title}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">{s.desc}</div>
              {s.action && (
                <div className="mt-3">
                  <Button size="sm" onClick={() => router.push(s.action!.href)}>
                    {s.action!.label}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
