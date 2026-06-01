"use client";

import { useEffect, useState } from "react";
import { LiveResults } from "@/components/live-results";
import { sections, type SectionId } from "@/lib/survey";

type AdminState = { collectionId: number; collectionName: string; activeSection: SectionId | null; acceptingResponses: boolean };
type CollectionSummary = { id: number; name: string; createdAt: string; participants: number; responses: number };
const presenterSections = sections.filter((section) => section.id !== "context");

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [state, setState] = useState<AdminState>({ collectionId: 1, collectionName: "Collection 1", activeSection: null, acceptingResponses: false });
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"presenter" | "data">("presenter");
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPassword(localStorage.getItem("adminPassword") || "");
  }, []);

  async function loadState() {
    const response = await fetch("/api/admin/state", {
      cache: "no-store",
      headers: { "x-admin-password": password }
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Unable to load admin state.");
      setIsLoggedIn(false);
      return;
    }
    applyAdminState(data as AdminState);
  }

  async function login() {
    setMessage("");
    localStorage.setItem("adminPassword", password);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "x-admin-password": password }
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Login failed.");
      setIsLoggedIn(false);
      return;
    }
    applyAdminState(data.state as AdminState);
    setIsLoggedIn(true);
    void loadCollections();
  }

  function applyAdminState(next: AdminState) {
    setState(next);
    const activeIndex = presenterSections.findIndex((section) => section.id === next.activeSection);
    if (activeIndex >= 0) {
      setPhaseIndex(activeIndex);
    }
  }

  async function saveState(next: Pick<AdminState, "activeSection" | "acceptingResponses">) {
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
    applyAdminState(data);
    setMessage("Session state updated.");
  }

  async function startOver() {
    if (!window.confirm("Start a new collection? Existing data will be kept for CSV export.")) return;
    setMessage("");
    const response = await fetch("/api/admin/reset", {
      method: "POST",
      headers: { "x-admin-password": password }
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Could not start a new collection.");
      return;
    }
    applyAdminState(data);
    setPhaseIndex(0);
    setMessage("New collection started. Previous data is preserved.");
    void loadCollections();
  }

  async function loadCollections() {
    const response = await fetch("/api/admin/collections", {
      cache: "no-store",
      headers: { "x-admin-password": password }
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Could not load collections.");
      return;
    }
    setCollections(data.collections || []);
  }

  async function exportCsv(collectionId?: number) {
    setMessage("");
    localStorage.setItem("adminPassword", password);
    const exportUrl = collectionId ? `/api/admin/export?collectionId=${collectionId}` : "/api/admin/export";
    const response = await fetch(exportUrl, {
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
    link.download = `genai-survey-${collectionId ? `collection-${collectionId}` : "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const currentPhase = presenterSections[phaseIndex];
  const isCurrentPhaseActive = state.activeSection === currentPhase.id && state.acceptingResponses;
  const isCurrentPhaseSelected = state.activeSection === currentPhase.id;

  return (
    <main className="page admin-page">
      <header className="topbar">
        <div>
          <div className="brand">Survey admin</div>
          <p className="hint">Open one section at a time.</p>
        </div>
        <span className={`status ${state.acceptingResponses ? "live" : "closed"}`}>
          {state.acceptingResponses ? "Accepting responses" : "Closed"}
        </span>
      </header>

      {!isLoggedIn ? (
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
              onKeyDown={(event) => {
                if (event.key === "Enter") void login();
              }}
            />
          </div>
          <div className="actions">
            <button type="button" onClick={login}>
              Login
            </button>
          </div>
          {message ? <p className="status">{message}</p> : null}
        </section>
      ) : (
        <>
      <nav className="admin-tabs" aria-label="Admin sections">
        <button className={activeTab === "presenter" ? "" : "secondary"} type="button" onClick={() => setActiveTab("presenter")}>
          Presenter
        </button>
        <button
          className={activeTab === "data" ? "" : "secondary"}
          type="button"
          onClick={() => {
            setActiveTab("data");
            void loadCollections();
          }}
        >
          Data
        </button>
      </nav>

      {activeTab === "presenter" ? (
      <section className="panel stack admin-console">
        <div className="admin-meta">
          <span>{state.collectionName}</span>
          <span>ID {state.collectionId}</span>
        </div>

        <div className="grid three" aria-label="Presenter phases">
          {presenterSections.map((section, index) => (
            <button
              key={section.id}
              className={index === phaseIndex ? "" : "secondary"}
              type="button"
              onClick={() => {
                setPhaseIndex(index);
                setMessage("");
              }}
            >
              {section.shortLabel}
            </button>
          ))}
        </div>

        <article className="stack">
          <div>
            <p className="status">{`Phase ${phaseIndex + 1} of ${presenterSections.length}`}</p>
            <h2>{currentPhase.label}</h2>
            <p className="hint">
              {isCurrentPhaseActive
                ? "Participants are answering this phase now."
                : isCurrentPhaseSelected
                  ? "This phase is selected but not accepting responses."
                  : "Start this phase when you are ready for participants to answer."}
            </p>
          </div>

          <LiveResults compact sectionId={currentPhase.id} />

          <div className="actions">
            <button type="button" onClick={() => saveState({ activeSection: currentPhase.id, acceptingResponses: true })} disabled={isCurrentPhaseActive}>
              Start this phase
            </button>
            <button className="secondary" type="button" onClick={() => saveState({ activeSection: currentPhase.id, acceptingResponses: false })}>
              Close responses
            </button>
          </div>
        </article>

        <div className="actions">
          <button className="secondary" type="button" disabled={phaseIndex === 0} onClick={() => setPhaseIndex((current) => Math.max(0, current - 1))}>
            Previous phase
          </button>
          <button
            type="button"
            disabled={phaseIndex === presenterSections.length - 1}
            onClick={() => {
              const nextIndex = Math.min(presenterSections.length - 1, phaseIndex + 1);
              setPhaseIndex(nextIndex);
              setMessage("Ready for the next phase. Click Start this phase when you want participants to answer.");
            }}
          >
            Next phase
          </button>
        </div>
        {message ? <p className="status">{message}</p> : null}
      </section>

      ) : (
      <section className="panel stack admin-console">
        <div className="admin-meta">
          <span>Data exports</span>
          <span>{collections.length} collections</span>
        </div>
        <div className="actions">
          <button type="button" onClick={() => exportCsv()}>
            Export all CSV
          </button>
          <button className="danger" type="button" onClick={startOver}>
            Start over
          </button>
        </div>
        <div className="collection-list">
          {collections.map((collection) => (
            <div className="collection-row" key={collection.id}>
              <div>
                <strong>{collection.name}</strong>
                <p className="hint">
                  ID {collection.id} - {collection.participants} participants - {collection.responses} answers - {collection.createdAt}
                </p>
              </div>
              <button className="secondary" type="button" onClick={() => exportCsv(collection.id)}>
                Export CSV
              </button>
            </div>
          ))}
        </div>
        {message ? <p className="status">{message}</p> : null}
      </section>
      )}
        </>
      )}
    </main>
  );
}
