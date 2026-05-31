"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  aiEntryTiming,
  aiOutputScope,
  classificationScenarios,
  contexts,
  demandScenarios,
  disciplines,
  policyContexts,
  roles,
  safeguards,
  sections,
  taxonomyUsefulness,
  type SectionId
} from "@/lib/survey";

type SavedResponse = { section: SectionId; questionKey: string; value: string; comment: string | null };
type SessionState = { activeSection: SectionId | null; acceptingResponses: boolean; updatedAt: string };

const emptySession: SessionState = { activeSection: null, acceptingResponses: false, updatedAt: "" };

function makeUuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function SurveyPage() {
  const [participantId, setParticipantId] = useState("");
  const [pseudonym, setPseudonym] = useState("");
  const [state, setState] = useState<SessionState>(emptySession);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [completedSections, setCompletedSections] = useState<SectionId[]>([]);
  const [isEditingContext, setIsEditingContext] = useState(false);
  const [message, setMessage] = useState("");
  const [pseudonymLinked, setPseudonymLinked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const storedId = localStorage.getItem("surveyParticipantId") || makeUuid();
    localStorage.setItem("surveyParticipantId", storedId);
    setParticipantId(storedId);

    const storedPseudonym = localStorage.getItem("surveyPseudonym") || "";
    setPseudonym(storedPseudonym);

    if (storedPseudonym.trim()) {
      void register(storedId, storedPseudonym);
    }
    void loadState();
    const interval = window.setInterval(loadState, 2500);
    return () => window.clearInterval(interval);
  }, []);

  async function register(id: string, alias: string) {
    if (!alias.trim()) {
      setPseudonymLinked(false);
      return;
    }

    const response = await fetch("/api/participants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantId: id, pseudonym: alias })
    });
    const data = (await response.json()) as { participantId: string; pseudonymLinked?: boolean; responses?: SavedResponse[]; error?: string };
    if (!response.ok) {
      setMessage(data.error || "A pseudonym is required.");
      setPseudonymLinked(false);
      return;
    }
    localStorage.setItem("surveyParticipantId", data.participantId);
    setParticipantId(data.participantId);
    setPseudonymLinked(Boolean(data.pseudonymLinked));
    const nextSaved: Record<string, string> = {};
    const nextComments: Record<string, string> = {};
    const nextCompletedSections = new Set<SectionId>();
    for (const item of data.responses || []) {
      nextSaved[item.questionKey] = item.value;
      if (item.comment) nextComments[item.questionKey] = item.comment;
      nextCompletedSections.add(item.section);
    }
    setSaved(nextSaved);
    setComments(nextComments);
    setCompletedSections(Array.from(nextCompletedSections));
  }

  async function loadState() {
    const response = await fetch("/api/session", { cache: "no-store" });
    setState((await response.json()) as SessionState);
  }

  const activeLabel = useMemo(
    () => sections.find((section) => section.id === state.activeSection)?.label || "Waiting for presenter",
    [state.activeSection]
  );
  const contextComplete = completedSections.includes("context");
  const isPresenterSectionOpen = Boolean(state.activeSection && state.acceptingResponses);
  const answerableSection: SectionId | null = !contextComplete || isEditingContext
    ? "context"
    : state.activeSection && state.acceptingResponses && !completedSections.includes(state.activeSection)
      ? state.activeSection
      : null;

  function updateValue(questionKey: string, value: string) {
    setSaved((current) => ({ ...current, [questionKey]: value }));
  }

  function updateComment(questionKey: string, value: string) {
    setComments((current) => ({ ...current, [questionKey]: value }));
  }

  async function savePseudonym() {
    if (!pseudonym.trim()) {
      setMessage("Enter a pseudonym before continuing.");
      setPseudonymLinked(false);
      return;
    }

    localStorage.setItem("surveyPseudonym", pseudonym);
    await register(participantId || makeUuid(), pseudonym);
    setMessage("Pseudonym linked. You can now answer the context questions.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answerableSection) return;
    if (!pseudonym.trim() || !pseudonymLinked) {
      setMessage("Enter and link your pseudonym before saving answers.");
      return;
    }
    setIsSaving(true);
    setMessage("");

    const responses = collectResponses(answerableSection, saved, comments);
    const response = await fetch("/api/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantId, pseudonym, section: answerableSection, responses })
    });
    const data = await response.json();
    setIsSaving(false);

    if (!response.ok) {
      setMessage(data.error || "Unable to save right now.");
      return;
    }

    if (data.participantId) {
      localStorage.setItem("surveyParticipantId", data.participantId);
      setParticipantId(data.participantId);
    }
    setCompletedSections((current) => (current.includes(answerableSection) ? current : [...current, answerableSection]));
    if (answerableSection === "context") {
      setIsEditingContext(false);
    }
    setMessage(answerableSection === "context" ? "Context saved. Please wait for the presenter to open the next section." : "Saved. Please wait for the next section.");
  }

  return (
    <main className="page narrow">
      <header className="topbar">
        <div>
          <div className="brand">Responsible GenAI Survey</div>
          <div className="hint">Participant: {participantId ? participantId.slice(0, 8) : "loading"}</div>
        </div>
        <span className={`status ${answerableSection ? "live" : "closed"}`}>
          {answerableSection === "context" ? "Context open" : answerableSection ? `Open: ${activeLabel}` : "Waiting"}
        </span>
      </header>

      <section className="panel stack">
        {pseudonymLinked ? (
          <div>
            <h1 className="page-title">Hi #{pseudonym}</h1>
            <p className="hint">Your responses are linked to this pseudonym for the session.</p>
          </div>
        ) : (
          <>
            <div className="field">
              <label className="label" htmlFor="pseudonym">
                Pseudonym for rejoining
              </label>
              <input
                id="pseudonym"
                value={pseudonym}
                onChange={(event) => setPseudonym(event.target.value)}
                placeholder="A memorable word or code"
                autoComplete="off"
                required
                aria-required="true"
              />
              <p className="hint">Required. Use the same pseudonym if you return on another device. It is stored only as a hash.</p>
            </div>
            <div className="actions">
              <button className="secondary" type="button" onClick={savePseudonym}>
                Link pseudonym
              </button>
            </div>
          </>
        )}
      </section>

      <form className="stack" onSubmit={submit}>
        {answerableSection ? (
          <ActiveSection
            section={answerableSection}
            values={saved}
            comments={comments}
            onValue={updateValue}
            onComment={updateComment}
          />
        ) : (
          <section className="panel stack">
            <h1 className="page-title">Please wait</h1>
            <p className="lede">
              {isPresenterSectionOpen
                ? "Your response for the open section is saved. Please wait for the presenter to open the next section."
                : "The presenter has not opened the next section yet. This page checks automatically."}
            </p>
            {contextComplete ? (
              <div className="actions">
                <button className="secondary" type="button" onClick={() => setIsEditingContext(true)}>
                  Edit context
                </button>
              </div>
            ) : null}
          </section>
        )}

        {message ? <p className="status">{message}</p> : null}

        {answerableSection ? (
          <div className="actions">
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Next"}
            </button>
          </div>
        ) : null}
      </form>
    </main>
  );
}

function ActiveSection(props: {
  section: SectionId;
  values: Record<string, string>;
  comments: Record<string, string>;
  onValue: (questionKey: string, value: string) => void;
  onComment: (questionKey: string, value: string) => void;
}) {
  if (props.section === "context") {
    return (
      <section className="panel stack">
        <h1 className="page-title">Participant context</h1>
        <MultiChoiceField label="Role" name="role" options={roles} {...props} />
        <MultiChoiceField label="Teaching or research context" name="teaching_context" options={contexts} {...props} />
        <MultiChoiceField label="Discipline" name="discipline" options={disciplines} {...props} />
        <SelectField label="Current GenAI policy context" name="policy_context" options={policyContexts} {...props} />
      </section>
    );
  }

  if (props.section === "demand") {
    return (
      <section className="panel stack">
        <h1 className="page-title">Responsible-use demand</h1>
        <p className="lede">Rate how much governance or instructional design attention each scenario demands.</p>
        {demandScenarios.map((scenario) => (
          <RatingField key={scenario.id} name={`${scenario.id}_rating`} title={scenario.title} prompt={scenario.prompt} {...props} />
        ))}
      </section>
    );
  }

  if (props.section === "classification") {
    return (
      <section className="panel stack">
        <h1 className="page-title">Design-space classification</h1>
        {classificationScenarios.map((scenario) => (
          <div className="panel stack" key={scenario.id}>
            <h2>{scenario.title}</h2>
            <p>{scenario.prompt}</p>
            <OptionField label="AI entry timing" name={`${scenario.id}_entry_timing`} options={aiEntryTiming} {...props} />
            <OptionField label="AI output scope" name={`${scenario.id}_output_scope`} options={aiOutputScope} {...props} />
            <RatingField name={`${scenario.id}_confidence_rating`} title="Confidence" prompt="How confident are you in this classification?" {...props} />
            <CommentField label="Optional comment" name={`${scenario.id}_comment`} {...props} />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="panel stack">
      <h1 className="page-title">Governance feedback</h1>
      <SelectField label="Selected safeguard" name="selected_safeguard" options={safeguards} {...props} />
      <CommentField label="Justification" name="safeguard_justification" {...props} />
      <CommentField label="Missing configuration" name="missing_configuration" {...props} />
      <SelectField label="Usefulness of taxonomy" name="taxonomy_usefulness" options={taxonomyUsefulness} {...props} />
      <CommentField label="Improvement suggestion" name="improvement_suggestion" {...props} />
    </section>
  );
}

function SelectField(props: FieldProps & { label: string; name: string; options: string[] }) {
  return (
    <div className="field">
      <label className="label" htmlFor={props.name}>
        {props.label}
      </label>
      <select id={props.name} value={props.values[props.name] || ""} onChange={(event) => props.onValue(props.name, event.target.value)}>
        <option value="">Choose one</option>
        {props.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function OptionField(props: FieldProps & { label: string; name: string; options: string[] }) {
  return (
    <fieldset className="field">
      <legend className="label">{props.label}</legend>
      <div className="option-list">
        {props.options.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name={props.name}
              value={option}
              checked={props.values[props.name] === option}
              onChange={(event) => props.onValue(props.name, event.target.value)}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function MultiChoiceField(props: FieldProps & { label: string; name: string; options: string[] }) {
  const selected = props.values[props.name] ? props.values[props.name].split("|") : [];
  const otherOption = props.options.find((option) => option.toLowerCase().includes("other"));
  const isOtherSelected = otherOption ? selected.includes(otherOption) : false;
  const otherKey = `${props.name}_other`;

  function toggle(option: string, checked: boolean) {
    const next = checked ? [...selected, option] : selected.filter((value) => value !== option);
    props.onValue(props.name, next.join("|"));
    if (option === otherOption && !checked) {
      props.onValue(otherKey, "");
    }
  }

  return (
    <fieldset className="field">
      <legend className="label">{props.label}</legend>
      <div className="option-list">
        {props.options.map((option) => (
          <label key={option}>
            <input
              type="checkbox"
              name={props.name}
              value={option}
              checked={selected.includes(option)}
              onChange={(event) => toggle(option, event.target.checked)}
            />
            {option}
          </label>
        ))}
      </div>
      {isOtherSelected ? (
        <div className="field">
          <label className="label" htmlFor={otherKey}>
            Please specify
          </label>
          <input
            id={otherKey}
            value={props.values[otherKey] || ""}
            onChange={(event) => props.onValue(otherKey, event.target.value)}
            placeholder={`Specify ${props.label.toLowerCase()}`}
          />
        </div>
      ) : null}
    </fieldset>
  );
}

function RatingField(props: FieldProps & { name: string; title: string; prompt: string }) {
  return (
    <fieldset className="field">
      <legend className="label">{props.title}</legend>
      <p className="hint">{props.prompt}</p>
      <div className="choice-grid">
        {[1, 2, 3, 4, 5].map((rating) => (
          <label key={rating}>
            <input
              type="radio"
              name={props.name}
              value={rating}
              checked={props.values[props.name] === String(rating)}
              onChange={(event) => props.onValue(props.name, event.target.value)}
            />
            {rating}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CommentField(props: FieldProps & { label: string; name: string }) {
  return (
    <div className="field">
      <label className="label" htmlFor={props.name}>
        {props.label}
      </label>
      <textarea id={props.name} value={props.comments[props.name] || ""} onChange={(event) => props.onComment(props.name, event.target.value)} />
    </div>
  );
}

type FieldProps = {
  values: Record<string, string>;
  comments: Record<string, string>;
  onValue: (questionKey: string, value: string) => void;
  onComment: (questionKey: string, value: string) => void;
};

function collectResponses(section: SectionId, values: Record<string, string>, comments: Record<string, string>) {
  const keysBySection: Record<SectionId, string[]> = {
    context: ["role", "role_other", "teaching_context", "teaching_context_other", "discipline", "discipline_other", "policy_context"],
    demand: demandScenarios.map((scenario) => `${scenario.id}_rating`),
    classification: classificationScenarios.flatMap((scenario) => [
      `${scenario.id}_entry_timing`,
      `${scenario.id}_output_scope`,
      `${scenario.id}_confidence_rating`,
      `${scenario.id}_comment`
    ]),
    governance: ["selected_safeguard", "safeguard_justification", "missing_configuration", "taxonomy_usefulness", "improvement_suggestion"]
  };

  return keysBySection[section].map((questionKey) => ({
    questionKey,
    value: values[questionKey] || comments[questionKey] || "",
    comment: comments[questionKey] && values[questionKey] ? comments[questionKey] : null
  }));
}
