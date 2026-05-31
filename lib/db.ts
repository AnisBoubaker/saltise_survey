import Database from "better-sqlite3";
import { createHash, randomUUID } from "crypto";
import { mkdirSync } from "fs";
import path from "path";
import { SectionId, sectionOrder } from "./survey";

type SqlValue = string | number | null;

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "survey.db");

let db: Database.Database | null = null;

function getDb() {
  if (db) return db;

  mkdirSync(dataDir, { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      pseudonym_hash TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS survey_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      active_section TEXT,
      accepting_responses INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id TEXT NOT NULL,
      section TEXT NOT NULL,
      question_key TEXT NOT NULL,
      value TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(participant_id, section, question_key),
      FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE
    );

    INSERT OR IGNORE INTO survey_state (id, active_section, accepting_responses)
    VALUES (1, NULL, 0);
  `);
}

function hashPseudonym(pseudonym: string) {
  const normalized = pseudonym.trim().toLowerCase();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

export function getSurveyState() {
  const row = getDb()
    .prepare("SELECT active_section as activeSection, accepting_responses as acceptingResponses, updated_at as updatedAt FROM survey_state WHERE id = 1")
    .get() as { activeSection: SectionId | null; acceptingResponses: 0 | 1; updatedAt: string };

  return {
    activeSection: row.activeSection,
    acceptingResponses: Boolean(row.acceptingResponses),
    updatedAt: row.updatedAt
  };
}

export function setSurveyState(activeSection: SectionId | null, acceptingResponses: boolean) {
  if (activeSection && !sectionOrder.includes(activeSection)) {
    throw new Error("Invalid section");
  }

  getDb()
    .prepare("UPDATE survey_state SET active_section = ?, accepting_responses = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1")
    .run(activeSection, acceptingResponses ? 1 : 0);

  return getSurveyState();
}

export function ensureParticipant(input: { participantId?: string; pseudonym?: string }) {
  const database = getDb();
  const pseudonymHash = input.pseudonym ? hashPseudonym(input.pseudonym) : null;

  if (!pseudonymHash) {
    throw new Error("A pseudonym is required.");
  }

  const existingByPseudonym = database
    .prepare("SELECT id FROM participants WHERE pseudonym_hash = ?")
    .get(pseudonymHash) as { id: string } | undefined;

  if (existingByPseudonym) {
    database.prepare("UPDATE participants SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").run(existingByPseudonym.id);
    return { id: existingByPseudonym.id, pseudonymLinked: true };
  }

  if (input.participantId) {
    const existing = database.prepare("SELECT id FROM participants WHERE id = ?").get(input.participantId) as { id: string } | undefined;
    if (existing) {
      database.prepare("UPDATE participants SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").run(input.participantId);
      database
        .prepare("UPDATE participants SET pseudonym_hash = COALESCE(pseudonym_hash, ?) WHERE id = ?")
        .run(pseudonymHash, input.participantId);
      return { id: input.participantId, pseudonymLinked: true };
    }
  }

  const id = input.participantId || randomUUID();
  database.prepare("INSERT INTO participants (id, pseudonym_hash) VALUES (?, ?)").run(id, pseudonymHash);
  return { id, pseudonymLinked: true };
}

export function upsertResponses(participantId: string, section: SectionId, responses: Array<{ questionKey: string; value: SqlValue; comment?: string | null }>) {
  const database = getDb();
  const insert = database.prepare(`
    INSERT INTO responses (participant_id, section, question_key, value, comment)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(participant_id, section, question_key)
    DO UPDATE SET value = excluded.value, comment = excluded.comment, updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = database.transaction(() => {
    for (const response of responses) {
      if (response.value === null || response.value === "") continue;
      insert.run(participantId, section, response.questionKey, String(response.value), response.comment || null);
    }
  });

  transaction();
}

export function getParticipantResponses(participantId: string) {
  return getDb()
    .prepare("SELECT section, question_key as questionKey, value, comment FROM responses WHERE participant_id = ?")
    .all(participantId) as Array<{ section: SectionId; questionKey: string; value: string; comment: string | null }>;
}

export function getDashboardData() {
  const database = getDb();
  const totalParticipants = (database.prepare("SELECT COUNT(*) as count FROM participants").get() as { count: number }).count;
  const totalResponses = (database.prepare("SELECT COUNT(*) as count FROM responses").get() as { count: number }).count;

  const bySection = database
    .prepare("SELECT section, COUNT(DISTINCT participant_id) as participants, COUNT(*) as answers FROM responses GROUP BY section")
    .all() as Array<{ section: SectionId; participants: number; answers: number }>;

  const ratings = database
    .prepare(`
      SELECT question_key as questionKey, value, COUNT(*) as count
      FROM responses
      WHERE section IN ('demand', 'classification') AND question_key LIKE '%rating%'
      GROUP BY question_key, value
      ORDER BY question_key, CAST(value AS INTEGER)
    `)
    .all() as Array<{ questionKey: string; value: string; count: number }>;

  const categories = database
    .prepare(`
      SELECT question_key as questionKey, value, COUNT(*) as count
      FROM responses
      WHERE section IN ('context', 'classification', 'governance')
        AND question_key NOT LIKE '%comment'
        AND question_key NOT LIKE '%justification'
        AND question_key NOT LIKE '%suggestion'
        AND question_key NOT LIKE '%missing%'
      GROUP BY question_key, value
      ORDER BY question_key, count DESC
    `)
    .all() as Array<{ questionKey: string; value: string; count: number }>;

  return {
    state: getSurveyState(),
    totalParticipants,
    totalResponses,
    bySection,
    ratings,
    categories,
    generatedAt: new Date().toISOString()
  };
}

export function getCsvRows() {
  return getDb()
    .prepare(`
      SELECT
        p.id as participant_id,
        CASE WHEN p.pseudonym_hash IS NULL THEN 'no' ELSE 'yes' END as has_pseudonym,
        p.created_at as participant_created_at,
        r.section,
        r.question_key,
        r.value,
        r.comment,
        r.created_at,
        r.updated_at
      FROM participants p
      LEFT JOIN responses r ON r.participant_id = p.id
      ORDER BY p.created_at, r.section, r.question_key
    `)
    .all() as Array<Record<string, string | null>>;
}

export function resetSurvey() {
  const database = getDb();
  const transaction = database.transaction(() => {
    database.prepare("DELETE FROM responses").run();
    database.prepare("DELETE FROM participants").run();
    setSurveyState(null, false);
  });
  transaction();
}
