"use client";

import { LiveResults, useDashboardData } from "@/components/live-results";
import { sections } from "@/lib/survey";

export default function LivePage() {
  const data = useDashboardData();
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

      <LiveResults />
    </main>
  );
}
