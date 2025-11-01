"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { IconResults } from "@/components/ui/Icons";

type Vote = { voter_id: string; voter_name: string | null; value: number };

type Sub = {
  id: string;
  text: string;
  participant_name: string | null;
  n: number;
  avg: number | null;
  stdev: number | null;
  votes: Vote[];
};

export default function BrainstormResults({ subs }: { subs: Sub[] }) {
  const avgVals = subs.map((s) => s.avg ?? 0).filter((v) => Number.isFinite(v));
  const stVals = subs.map((s) => s.stdev ?? 0).filter((v) => Number.isFinite(v));
  const nVals = subs.map((s) => s.n ?? 0);
  const consVals = subs
    .map((s) => 1 / (1 + ((s.stdev ?? 0) as number)))
    .filter((v) => Number.isFinite(v));

  function minMax(vals: number[]) {
    if (!vals.length) return { min: 0, max: 0 };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }

  const avgMM = minMax(avgVals);
  const stMM = minMax(stVals);
  const nMM = minMax(nVals);
  const cMM = minMax(consVals);

  function norm(v: number, mm: { min: number; max: number }, invert = false) {
    const d = mm.max - mm.min;
    if (d <= 0) return 0.5;
    const x = (v - mm.min) / d;
    return invert ? 1 - x : x;
  }

  function badge(label: string, valStr: string, score: number) {
    let tone = "border-white/10 bg-white/5 text-[var(--text)]";
    if (score >= 0.67) tone = "border-green-400/30 bg-green-500/15 text-[var(--text)]";
    else if (score >= 0.33) tone = "border-amber-400/30 bg-amber-500/15 text-[var(--text)]";
    else tone = "border-red-400/30 bg-red-500/15 text-[var(--text)]";
    return <span className={`px-1.5 py-0.5 rounded border ${tone}`}>{label} {valStr}</span>;
  }

  const [sortKey, setSortKey] = useState<"avg" | "stdev" | "n" | "consensus" | "idea" | "author">("avg");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [ideaQuery, setIdeaQuery] = useState("");
  const [authorQuery, setAuthorQuery] = useState("");
  const [minAvg, setMinAvg] = useState<string]("");
  const [maxStdev, setMaxStdev] = useState<string]("");
  const [minN, setMinN] = useState<string]("");

  function getSortValue(s: Sub) {
    const consensusVal = 1 / (1 + ((s.stdev ?? 0) as number));
    switch (sortKey) {
      case "avg": return s.avg ?? -Infinity;
      case "stdev": return s.stdev ?? Infinity;
      case "n": return s.n ?? 0;
      case "consensus": return consensusVal;
      case "idea": return (s.text || "").toLowerCase();
      case "author": return (s.participant_name || "").toLowerCase();
    }
  }

  const filteredSorted = useMemo(() => {
    const q = ideaQuery.trim().toLowerCase();
    const qa = authorQuery.trim().toLowerCase();
    const minAvgNum = minAvg.trim() === "" ? null : Number(minAvg);
    const maxStNum = maxStdev.trim() === "" ? null : Number(maxStdev);
    const minNNum = minN.trim() === "" ? null : Number(minN);
    const rows = subs.filter((s) => {
      if (q && !(s.text || "").toLowerCase().includes(q)) return false;
      if (qa && !(s.participant_name || "").toLowerCase().includes(qa)) return false;
      if (minAvgNum !== null && Number.isFinite(minAvgNum)) { if ((s.avg ?? -Infinity) < minAvgNum) return false; }
      if (maxStNum !== null && Number.isFinite(maxStNum)) { if ((s.stdev ?? Infinity) > maxStNum) return false; }
      if (minNNum !== null && Number.isFinite(minNNum)) { if ((s.n ?? 0) < minNNum) return false; }
      return true;
    });
    rows.sort((a, b) => {
      const av = getSortValue(a) as any; const bv = getSortValue(b) as any;
      if (av === bv) return 0; const dir = sortDir === "asc" ? 1 : -1;
      if (typeof av === "string" && typeof bv === "string") return av < bv ? -1 * dir : 1 * dir;
      return (Number(av) - Number(bv)) * dir;
    });
    return rows;
  }, [subs, ideaQuery, authorQuery, minAvg, maxStdev, minN, sortKey, sortDir]);

  function onHeaderClick(k: typeof sortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "stdev" ? "asc" : "desc"); }
  }

  function sortIndicator(k: typeof sortKey) {
    if (sortKey !== k) return null;
    return <span className="ml-1 opacity-70">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div className="space-y-4">
      <Scatter
        points={subs.map((s) => ({ id: s.id, label: s.text, avg: s.avg ?? 0, stdev: s.stdev ?? 0, n: s.n }))}
      />
      <div className="overflow-x-auto rounded-[var(--radius)] border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left cursor-pointer" onClick={() => onHeaderClick("idea")}>
                Idea{sortIndicator("idea")}
              </th>
              <th className="px-3 py-2 text-right cursor-pointer" onClick={() => onHeaderClick("avg")}>
                Avg{sortIndicator("avg")}
              </th>
              <th className="px-3 py-2 text-right cursor-pointer" onClick={() => onHeaderClick("stdev")}>
                Stdev{sortIndicator("stdev")}
              </th>
              <th className="px-3 py-2 text-right cursor-pointer" onClick={() => onHeaderClick("n")}>
                N{sortIndicator("n")}
              </th>
              <th className="px-3 py-2 text-right cursor-pointer" onClick={() => onHeaderClick("consensus")}>
                Consensus{sortIndicator("consensus")}
              </th>
              <th className="px-3 py-2 text-left cursor-pointer" onClick={() => onHeaderClick("author")}>
                Author{sortIndicator("author")}
              </th>
            </tr>
            <tr className="text-xs">
              <th />
              <th className="px-3 py-1">
                <input placeholder="Filter idea" value={ideaQuery} onChange={(e) => setIdeaQuery(e.target.value)} className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 outline-none" />
              </th>
              <th className="px-3 py-1 text-right">
                <input placeholder=">= avg" value={minAvg} onChange={(e) => setMinAvg(e.target.value)} className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-right outline-none" />
              </th>
              <th className="px-3 py-1 text-right">
                <input placeholder="<= stdev" value={maxStdev} onChange={(e) => setMaxStdev(e.target.value)} className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-right outline-none" />
              </th>
              <th className="px-3 py-1 text-right">
                <input placeholder=">= N" value={minN} onChange={(e) => setMinN(e.target.value)} className="w-20 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-right outline-none" />
              </th>
              <th />
              <th className="px-3 py-1">
                <input placeholder="Filter author" value={authorQuery} onChange={(e) => setAuthorQuery(e.target.value)} className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 outline-none" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map((s, idx) => {
              const avg = isFinite(Number(s.avg)) ? Number(s.avg) : 0;
              const stdev = isFinite(Number(s.stdev)) ? Number(s.stdev) : 0;
              const consensus = 1 / (1 + stdev);
              return (
                <tr key={s.id} className="border-t border-white/10">
                  <td className="px-3 py-2 text-left text-xs text-[var(--muted)]">{idx + 1}</td>
                  <td className="px-3 py-2 text-left min-w-[220px]">
                    <div className="font-medium mb-1">{s.text}</div>
                    <div className="flex flex-wrap gap-1 text-[10px] text-[var(--muted)]">
                      {badge("Avg:", isFinite(avg) ? avg.toFixed(2) : "-", norm(avg, avgMM))}
                      {badge("Stdev:", isFinite(stdev) ? stdev.toFixed(2) : "-", norm(stdev, stMM, true))}
                      {badge("N:", String(s.n ?? 0), norm(Number(s.n ?? 0), nMM))}
                      {badge("Consensus:", consensus.toFixed(2), norm(consensus, cMM))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{isFinite(avg) ? avg.toFixed(2) : "-"}</td>
                  <td className="px-3 py-2 text-right font-mono">{isFinite(stdev) ? stdev.toFixed(2) : "-"}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.n ?? 0}</td>
                  <td className="px-3 py-2 text-right font-mono">{consensus.toFixed(2)}</td>
                  <td className="px-3 py-2 text-left align-top text-xs text-[var(--muted)]">{s.participant_name || "Anonymous"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Scatter({ points }: { points: { id: string; label: string; avg: number; stdev: number; n: number }[] }) {
  const rows = useMemo(() => points.map((p, i) => ({ idx: i + 1, ...p, consensus: 1 / (1 + (isFinite(p.stdev) ? p.stdev : 0)) })), [points]);
  const maxAvg = useMemo(() => rows.reduce((m, r) => Math.max(m, isFinite(r.avg) ? r.avg : 0), 0), [rows]);
  const maxCons = 1;
  const W = 560; const H = 180; const px = 48; const py = 24; const innerW = W - px * 2; const innerH = H - py * 2;
  function x(cons: number) { return px + (innerW * Math.max(0, Math.min(maxCons, cons))) / maxCons; }
  function y(avg: number) { const m = maxAvg || 1; return py + innerH - (innerH * Math.max(0, Math.min(m, avg))) / m; }
  const ticksY = 4; const ticksX = 4;
  return (
    <Card>
      <CardHeader title={<><IconResults className="text-[var(--brand)]" /><span>Consensus vs. Average</span></>} subtitle={"X: consensus (1/(1+stdev)) - higher is better | Y: average score"} />
      <CardBody className="overflow-x-auto">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ height: H }}>
          <line x1={px} y1={py} x2={px} y2={py + innerH} stroke="currentColor" strokeOpacity="0.2" />
          <line x1={px} y1={py + innerH} x2={px + innerW} y2={py + innerH} stroke="currentColor" strokeOpacity="0.2" />
          {Array.from({ length: ticksY + 1 }).map((_, i) => { const val = (maxAvg * i) / ticksY; const yy = y(val); return (
            <g key={`yt${i}`}>
              <line x1={px - 4} x2={px} y1={yy} y2={yy} stroke="currentColor" strokeOpacity="0.3" />
              <text x={px - 8} y={yy + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">{val.toFixed(0)}</text>
            </g>
          ); })}
          {Array.from({ length: ticksX + 1 }).map((_, i) => { const val = (maxCons * i) / ticksX; const xx = x(val); return (
            <g key={`xt${i}`}>
              <line x1={xx} x2={xx} y1={py + innerH} y2={py + innerH + 4} stroke="currentColor" strokeOpacity="0.3" />
              <text x={xx} y={py + innerH + 14} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">{val.toFixed(2)}</text>
            </g>
          ); })}
          {rows.map((r) => (
            <g key={r.id}>
              <title>{`${r.idx}. ${r.label}\nAvg: ${isFinite(r.avg) ? r.avg.toFixed(2) : "-"} | Stdev: ${isFinite(r.stdev) ? r.stdev.toFixed(2) : "-"}`}</title>
              <circle cx={x(r.consensus)} cy={y(r.avg)} r={8} fill="var(--brand)" fillOpacity="0.95" stroke="currentColor" strokeOpacity="0.15" />
              <text x={x(r.consensus)} y={y(r.avg) + 3} textAnchor="middle" fontSize="10" fill="#ffffff">{r.idx}</text>
            </g>
          ))}
        </svg>
      </CardBody>
    </Card>
  );
}



