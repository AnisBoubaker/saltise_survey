"use client";

import { useEffect, useState } from "react";
import { sections, type SectionId } from "@/lib/survey";

type AdminState = { activeSection: SectionId | null; acceptingResponses: boolean };

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [state, setState] = useState<AdminState>({ activeSection: null, acceptingResponses: false });
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPassword(localStorage.getItem("adminPassword") || "");
    void loadState();
  }, []);

  async function loadState() {
    const response = await fetch("/api/admin/state", { cache: "no-store" });
    setState((await response.json()) as AdminState);
  }

  async function saveState(next: AdminState) {
    setMessage("");
    localStorage.setItem("adminPassword", password);
    const response = await fetch("/api/admin/state", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-password": password },
      body: JSON.stringify(next)
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Admin update failed.");
      return;
    }
    setState(data);
    setMessage("Session state updated.");
  }

  async function reset() {
    if (!window.confirm("Reset all participants and responses?")) return;
    setMessage("");
    const response = await fetch("/api/admin/reset", {
      method: "POST",
      headers: { "x-admin-password": password }
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Reset failed.");
      return;
    }
    setState({ activeSection: null, acceptingResponses: false });
    setMessage("Survey reset.");
  }

  async function exportCsv() {
    setMessage("");
    localStorage.setItem("adminPassword", password);
    const response = await fetch("/api/admin/export", {
      headers: { "x-admin-password": password }
    });
    if (!response.ok) {
      const data = await response.json();
      setMessage(data.error || "Export failed.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `genai-survey-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page narrow">
      <header className="topbar">
        <div>
          <div className="brand">Survey admin</div>
          <p className="hint">Open one section at a time for participants.</p>
        </div>
        <span className={`status ${state.acceptingResponses ? "live" : "closed"}`}>
          {state.acceptingResponses ? "Accepting responses" : "Closed"}
        </span>
      </header>

      <section className="panel stack">
        <div className="field">
          <label className="label" htmlFor="password">
            Admin password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="ADMIN_PASSWORD"
            autoComplete="current-password"
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="active-section">
            Active section
          </label>
          <select
            id="active-section"
            value={state.activeSection || ""}
            onChange={(event) => setState((current) => ({ ...current, activeSection: (event.target.value || null) as SectionId | null }))}
          >
            <option value="">No active section</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
        </div>

        <label className="panel" style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
          <input
            style={{ width: "auto" }}
            type="checkbox"
            checked={state.acceptingResponses}
            onChange={(event) => setState((current) => ({ ...current, acceptingResponses: event.target.checked }))}
          />
          Accept responses for selected section
        </label>

        <div className="actions">
          <button type="button" onClick={() => saveState(state)}>
            Save session state
          </button>
          <button className="secondary" type="button" onClick={() => saveState({ activeSection: state.activeSection, acceptingResponses: false })}>
            Pause responses
          </button>
        </div>
      </section>

      <section className="panel stack" style={{ marginTop: "1rem" }}>
        <h1 className="page-title">Data</h1>
        <div className="actions">
          <button type="button" onClick={exportCsv}>
            Export CSV
          </button>
          <button className="danger" type="button" onClick={reset}>
            Reset survey
          </button>
        </div>
        {message ? <p className="status">{message}</p> : null}
      </section>
    </main>
  );
}
