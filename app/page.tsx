"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [participantId, setParticipantId] = useState<string | null>(null);

  useEffect(() => {
    setParticipantId(localStorage.getItem("surveyParticipantId"));
  }, []);

  return (
    <main className="page narrow hero">
      <div className="stack">
        <p className="status">Conference audience survey</p>
        <h1>Responsible GenAI Use in Programming Education</h1>
        <p className="lede">
          This anonymous survey collects audience responses during the presentation. Your answers are linked with a random
          participant ID and a required pseudonym so you can close the page and continue later.
        </p>
        <section className="panel stack" aria-labelledby="consent-title">
          <h2 id="consent-title">Consent statement</h2>
          <p>
            Participation is voluntary. Do not enter identifying information in comments. Results may be shown live in
            aggregate and exported for presentation analysis. You may stop responding at any time by closing this page.
          </p>
          {participantId ? <p className="hint">Returning participant ID detected on this device.</p> : null}
          <div className="actions">
            <Link className="button" href="/survey">
              Start
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
