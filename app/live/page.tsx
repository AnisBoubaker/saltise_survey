"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { sections } from "@/lib/survey";

type DashboardData = {
  state: { activeSection: string | null; acceptingResponses: boolean };
  totalParticipants: number;
  totalResponses: number;
  bySection: Array<{ section: string; participants: number; answers: number }>;
  ratings: Array<{ questionKey: string; value: string; count: number }>;
  categories: Array<{ questionKey: string; value: string; count: number }>;
  generatedAt: string;
};

export default function LivePage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 2500);
    return () => window.clearInterval(interval);
  }, []);

  async function load() {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    setData((await response.json()) as DashboardData);
  }

  const ratingCharts = useMemo(() => groupRows(data?.ratings || []), [data]);
  const categoryCharts = useMemo(() => groupRows(data?.categories || []).slice(0, 8), [data]);
  const activeLabel = sections.find((section) => section.id === data?.state.activeSection)?.label || "No section active";

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <div className="brand">Live results</div>
          <p className="hint">Auto-refreshing aggregate dashboard</p>
        </div>
        <span className={`status ${data?.state.acceptingResponses ? "live" : "closed"}`}>
          {data?.state.acceptingResponses ? `Open: ${activeLabel}` : activeLabel}
        </span>
      </header>

      <section className="grid three">
        <div className="metric">
          <span className="hint">Participants</span>
          <strong>{data?.totalParticipants ?? 0}</strong>
        </div>
        <div className="metric">
          <span className="hint">Answer rows</span>
          <strong>{data?.totalResponses ?? 0}</strong>
        </div>
        <div className="metric">
          <span className="hint">Updated</span>
          <strong style={{ fontSize: "1rem" }}>{data ? new Date(data.generatedAt).toLocaleTimeString() : "Loading"}</strong>
        </div>
      </section>

      <section className="grid two" style={{ marginTop: "1rem" }}>
        <ChartPanel
          title="Section completion"
          data={(data?.bySection || []).map((row) => ({ name: sectionName(row.section), count: row.participants }))}
        />
        {ratingCharts.map(([questionKey, rows]) => (
          <ChartPanel key={questionKey} title={cleanKey(questionKey)} data={rows.map((row) => ({ name: row.value, count: row.count }))} />
        ))}
        {categoryCharts.map(([questionKey, rows]) => (
          <ChartPanel key={questionKey} title={cleanKey(questionKey)} data={rows.map((row) => ({ name: row.value, count: row.count }))} />
        ))}
      </section>
    </main>
  );
}

function ChartPanel({ title, data }: { title: string; data: Array<{ name: string; count: number }> }) {
  return (
    <article className="panel stack">
      <h2>{title}</h2>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, bottom: 42, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={70} tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function groupRows(rows: Array<{ questionKey: string; value: string; count: number }>) {
  const groups = new Map<string, Array<{ value: string; count: number }>>();
  for (const row of rows) {
    const list = groups.get(row.questionKey) || [];
    list.push({ value: row.value, count: row.count });
    groups.set(row.questionKey, list);
  }
  return Array.from(groups.entries());
}

function sectionName(id: string) {
  return sections.find((section) => section.id === id)?.shortLabel || id;
}

function cleanKey(key: string) {
  return key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Ai", "AI");
}
