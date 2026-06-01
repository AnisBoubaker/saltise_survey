"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { classificationScenarios, demandScenarios, sections } from "@/lib/survey";

export type DashboardData = {
  state: { activeSection: string | null; acceptingResponses: boolean };
  totalParticipants: number;
  totalResponses: number;
  bySection: Array<{ section: string; participants: number; answers: number }>;
  ratings: Array<{ questionKey: string; value: string; count: number }>;
  categories: Array<{ questionKey: string; value: string; count: number }>;
  customScenarios: Array<{ participantId: string; scenario: string; rating: string | null }>;
  generatedAt: string;
};

export function useDashboardData() {
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

  return data;
}

export function LiveResults({ compact = false, sectionId }: { compact?: boolean; sectionId?: string }) {
  const data = useDashboardData();
  const ratingCharts = useMemo(() => groupRows(data?.ratings || []), [data]);
  const categoryCharts = useMemo(() => groupRows(data?.categories || []), [data]);
  const filteredRatingCharts = sectionId ? ratingCharts.filter(([questionKey]) => chartBelongsToSection(questionKey, sectionId)) : ratingCharts;
  const filteredCategoryCharts = sectionId ? categoryCharts.filter(([questionKey]) => chartBelongsToSection(questionKey, sectionId)) : categoryCharts;
  const charts = orderCharts([...filteredRatingCharts, ...filteredCategoryCharts], sectionId).slice(0, sectionId ? undefined : 8);
  const customScenarios = sectionId === "demand" ? data?.customScenarios || [] : [];
  const sectionSummary = sectionId ? data?.bySection.find((row) => row.section === sectionId) : null;
  const participantCount = sectionId ? sectionSummary?.participants ?? 0 : data?.totalParticipants ?? 0;
  const answerCount = sectionId ? sectionSummary?.answers ?? 0 : data?.totalResponses ?? 0;

  return (
    <section className={compact ? "live-inline stack" : "stack"}>
      {compact ? (
        <div className="admin-meta">
          <span>Live results</span>
          <span>Updates every 2.5s</span>
        </div>
      ) : null}
      <div className="grid three">
        <div className="metric">
          <span className="hint">Participants</span>
          <strong>{participantCount}</strong>
        </div>
        <div className="metric">
          <span className="hint">Answer rows</span>
          <strong>{answerCount}</strong>
        </div>
        <div className="metric">
          <span className="hint">Updated</span>
          <strong style={{ fontSize: "1rem" }}>{data ? new Date(data.generatedAt).toLocaleTimeString() : "Loading"}</strong>
        </div>
      </div>

      {sectionId === "classification" ? (
        <ClassificationResults charts={charts} compact={compact} />
      ) : (
        <div className={compact ? "grid two live-inline-grid" : "grid two"}>
          {!sectionId ? (
          <ChartPanel
            title="Section completion"
            data={(data?.bySection || []).map((row) => ({ name: sectionName(row.section), count: row.participants }))}
            compact={compact}
          />
          ) : null}
          {charts.map(([questionKey, rows]) => (
            <ChartPanel key={questionKey} title={cleanKey(questionKey)} data={rows.map((row) => ({ name: row.value, count: row.count }))} compact={compact} />
          ))}
          {charts.length === 0 && customScenarios.length === 0 ? (
            <div className="empty-results">
              <strong>No chart data yet</strong>
              <p className="hint">Charts will appear here as soon as participants submit answers for this phase.</p>
            </div>
          ) : null}
        </div>
      )}
      {customScenarios.length > 0 ? <CustomScenarioTable rows={customScenarios} /> : null}
    </section>
  );
}

function ChartPanel({ title, data, compact = false }: { title: string; data: Array<{ name: string; count: number }>; compact?: boolean }) {
  const chartData = data.map((row) => ({ ...row, name: ratingLabel(row.name) }));

  return (
    <article className={compact ? "chart-panel stack" : "panel stack"}>
      <h2>{title}</h2>
      <div className={compact ? "chart-box compact" : "chart-box"}>
        <ResponsiveContainer width="100%" height="100%">
          {compact ? (
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 84 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" radius={[0, 4, 4, 0]} />
            </BarChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 72, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={92} tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function CustomScenarioTable({ rows }: { rows: Array<{ participantId: string; scenario: string; rating: string | null }> }) {
  return (
    <div className="custom-scenario-table">
      <h2>Custom classroom scenarios</h2>
      <table>
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Demand rating</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.participantId}-${row.scenario}`}>
              <td>{row.scenario}</td>
              <td>{row.rating ? ratingLabel(row.rating) : "Not rated"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassificationResults({ charts, compact }: { charts: Array<[string, Array<{ value: string; count: number }>]>, compact: boolean }) {
  const chartMap = new Map(charts);
  const hasAnyChart = charts.length > 0;

  if (!hasAnyChart) {
    return (
      <div className="empty-results">
        <strong>No chart data yet</strong>
        <p className="hint">Charts will appear here as soon as participants submit answers for this phase.</p>
      </div>
    );
  }

  return (
    <div className="classification-results stack">
      {classificationScenarios.map((scenario) => {
        const subquestions = [
          { key: `${scenario.id}_entry_timing`, title: "AI entry timing" },
          { key: `${scenario.id}_output_scope`, title: "AI output scope" },
          { key: `${scenario.id}_confidence_rating`, title: "Confidence rating" }
        ];
        const availableSubquestions = subquestions.filter((subquestion) => chartMap.has(subquestion.key));

        if (availableSubquestions.length === 0) return null;

        return (
          <section className="classification-group stack" key={scenario.id}>
            <div>
              <h2>{scenario.title}</h2>
              <p className="hint">{scenario.prompt}</p>
            </div>
            <div className={compact ? "grid three" : "grid three"}>
              {availableSubquestions.map((subquestion) => {
                const rows = chartMap.get(subquestion.key) || [];
                return (
                  <ChartPanel
                    key={subquestion.key}
                    title={subquestion.title}
                    data={rows.map((row) => ({ name: row.value, count: row.count }))}
                    compact={compact}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
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

function chartBelongsToSection(questionKey: string, sectionId: string) {
  if (sectionId === "demand") {
    return demandScenarios.some((scenario) => questionKey === `${scenario.id}_rating`);
  }
  if (sectionId === "classification") {
    return classificationScenarios.some((scenario) => questionKey.startsWith(`${scenario.id}_`));
  }
  if (sectionId === "governance") {
    return ["selected_safeguard", "taxonomy_usefulness"].some((key) => questionKey === key);
  }
  return false;
}

function orderCharts(charts: Array<[string, Array<{ value: string; count: number }>]>, sectionId?: string) {
  if (!sectionId) return charts;

  const orderedKeys =
    sectionId === "demand"
      ? demandScenarios.map((scenario) => `${scenario.id}_rating`)
      : sectionId === "classification"
        ? classificationScenarios.flatMap((scenario) => [
            `${scenario.id}_entry_timing`,
            `${scenario.id}_output_scope`,
            `${scenario.id}_confidence_rating`
          ])
        : sectionId === "governance"
          ? ["selected_safeguard", "taxonomy_usefulness"]
          : [];

  const order = new Map(orderedKeys.map((key, index) => [key, index]));
  return [...charts].sort(([left], [right]) => (order.get(left) ?? 999) - (order.get(right) ?? 999) || left.localeCompare(right));
}

function ratingLabel(value: string) {
  const labels: Record<string, string> = {
    "1": "Very low",
    "2": "Low",
    "3": "Moderate",
    "4": "High",
    "5": "Very high",
    "Unclear, I don't know": "Unclear"
  };
  return labels[value] || value;
}

function cleanKey(key: string) {
  return key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Ai", "AI");
}
