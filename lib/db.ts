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
  database.pragma("foreign_keys = OFF");
  database.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO collections (id, name)
    VALUES (1, 'Collection 1');

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      collection_id INTEGER NOT NULL DEFAULT 1,
      pseudonym_hash TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(collection_id) REFERENCES collections(id)
    );

    CREATE TABLE IF NOT EXISTS survey_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_collection_id INTEGER NOT NULL DEFAULT 1,
      active_section TEXT,
      accepting_responses INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(current_collection_id) REFERENCES collections(id)
    );

    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL DEFAULT 1,
      participant_id TEXT NOT NULL,
      section TEXT NOT NULL,
      question_key TEXT NOT NULL,
      value TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(collection_id, participant_id, section, question_key),
      FOREIGN KEY(collection_id) REFERENCES collections(id),
      FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE
    );

  `);

  const participantColumns = tableColumns(database, "participants");
  const responseColumns = tableColumns(database, "responses");
  const stateColumns = tableColumns(database, "survey_state");

  if (!participantColumns.includes("collection_id") || hasGlobalParticipantPseudonymIndex(database)) {
    database.exec(`
      CREATE TABLE participants_next (
        id TEXT PRIMARY KEY,
        collection_id INTEGER NOT NULL DEFAULT 1,
        pseudonym_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(collection_id, pseudonym_hash),
        FOREIGN KEY(collection_id) REFERENCES collections(id)
      );

      INSERT OR IGNORE INTO participants_next (id, collection_id, pseudonym_hash, created_at, last_seen_at)
      SELECT id, 1, pseudonym_hash, created_at, last_seen_at
      FROM participants
      WHERE pseudonym_hash IS NOT NULL;

      DROP TABLE participants;
      ALTER TABLE participants_next RENAME TO participants;
    `);
  }

  if (!stateColumns.includes("current_collection_id")) {
    database.exec("ALTER TABLE survey_state ADD COLUMN current_collection_id INTEGER NOT NULL DEFAULT 1 REFERENCES collections(id)");
  }

  database.exec(`
    INSERT OR IGNORE INTO survey_state (id, current_collection_id, active_section, accepting_responses)
    VALUES (1, 1, NULL, 0);
  `);

  if (!responseColumns.includes("collection_id") || hasOldResponseUniqueIndex(database)) {
    database.exec(`
      CREATE TABLE responses_next (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL DEFAULT 1,
        participant_id TEXT NOT NULL,
        section TEXT NOT NULL,
        question_key TEXT NOT NULL,
        value TEXT NOT NULL,
        comment TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(collection_id, participant_id, section, question_key),
        FOREIGN KEY(collection_id) REFERENCES collections(id),
        FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE
      );

      INSERT OR IGNORE INTO responses_next (id, collection_id, participant_id, section, question_key, value, comment, created_at, updated_at)
      SELECT id, 1, participant_id, section, question_key, value, comment, created_at, updated_at
      FROM responses;

      DROP TABLE responses;
      ALTER TABLE responses_next RENAME TO responses;
    `);
  }

  database.pragma("foreign_keys = ON");
}

function tableColumns(database: Database.Database, table: string) {
  return database.prepare(`PRAGMA table_info(${table})`).all().map((row) => (row as { name: string }).name);
}

function hasGlobalParticipantPseudonymIndex(database: Database.Database) {
  const indexes = database.prepare("PRAGMA index_list(participants)").all() as Array<{ name: string; unique: 0 | 1 }>;
  return indexes.some((index) => {
    if (!index.unique) return false;
    const columns = database.prepare(`PRAGMA index_info(${index.name})`).all().map((row) => (row as { name: string }).name);
    return columns.length === 1 && columns[0] === "pseudonym_hash";
  });
}

function hasOldResponseUniqueIndex(database: Database.Database) {
  const indexes = database.prepare("PRAGMA index_list(responses)").all() as Array<{ name: string; unique: 0 | 1 }>;
  return indexes.some((index) => {
    if (!index.unique) return false;
    const columns = database.prepare(`PRAGMA index_info(${index.name})`).all().map((row) => (row as { name: string }).name);
    return columns.join(",") === "participant_id,section,question_key";
  });
}

function hashPseudonym(pseudonym: string) {
  const normalized = pseudonym.trim().toLowerCase();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

export function getSurveyState() {
  const row = getDb()
    .prepare(`
      SELECT
        s.current_collection_id as collectionId,
        c.name as collectionName,
        active_section as activeSection,
        accepting_responses as acceptingResponses,
        s.updated_at as updatedAt
      FROM survey_state s
      JOIN collections c ON c.id = s.current_collection_id
      WHERE s.id = 1
    `)
    .get() as { collectionId: number; collectionName: string; activeSection: SectionId | null; acceptingResponses: 0 | 1; updatedAt: string };

  return {
    collectionId: row.collectionId,
    collectionName: row.collectionName,
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
  const collectionId = getSurveyState().collectionId;
  const pseudonymHash = input.pseudonym ? hashPseudonym(input.pseudonym) : null;

  if (!pseudonymHash) {
    throw new Error("A pseudonym is required.");
  }

  const existingByPseudonym = database
    .prepare("SELECT id FROM participants WHERE collection_id = ? AND pseudonym_hash = ?")
    .get(collectionId, pseudonymHash) as { id: string } | undefined;

  if (existingByPseudonym) {
    database.prepare("UPDATE participants SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").run(existingByPseudonym.id);
    return { id: existingByPseudonym.id, pseudonymLinked: true };
  }

  if (input.participantId) {
    const existing = database.prepare("SELECT id FROM participants WHERE collection_id = ? AND id = ?").get(collectionId, input.participantId) as { id: string } | undefined;
    if (existing) {
      database.prepare("UPDATE participants SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").run(input.participantId);
      database
        .prepare("UPDATE participants SET pseudonym_hash = COALESCE(pseudonym_hash, ?) WHERE id = ?")
        .run(pseudonymHash, input.participantId);
      return { id: input.participantId, pseudonymLinked: true };
    }
  }

  const existingGlobalId = input.participantId
    ? (database.prepare("SELECT id FROM participants WHERE id = ?").get(input.participantId) as { id: string } | undefined)
    : undefined;
  const id = input.participantId && !existingGlobalId ? input.participantId : randomUUID();
  database.prepare("INSERT INTO participants (id, collection_id, pseudonym_hash) VALUES (?, ?, ?)").run(id, collectionId, pseudonymHash);
  return { id, pseudonymLinked: true };
}

export function upsertResponses(participantId: string, section: SectionId, responses: Array<{ questionKey: string; value: SqlValue; comment?: string | null }>) {
  const database = getDb();
  const collectionId = getSurveyState().collectionId;
  const insert = database.prepare(`
    INSERT INTO responses (collection_id, participant_id, section, question_key, value, comment)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(collection_id, participant_id, section, question_key)
    DO UPDATE SET value = excluded.value, comment = excluded.comment, updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = database.transaction(() => {
    for (const response of responses) {
      if (response.value === null || response.value === "") continue;
      insert.run(collectionId, participantId, section, response.questionKey, String(response.value), response.comment || null);
    }
  });

  transaction();
}

export function getParticipantResponses(participantId: string) {
  const collectionId = getSurveyState().collectionId;
  return getDb()
    .prepare("SELECT section, question_key as questionKey, value, comment FROM responses WHERE collection_id = ? AND participant_id = ?")
    .all(collectionId, participantId) as Array<{ section: SectionId; questionKey: string; value: string; comment: string | null }>;
}

export function getDashboardData() {
  const database = getDb();
  const state = getSurveyState();
  const totalParticipants = (database.prepare("SELECT COUNT(*) as count FROM participants WHERE collection_id = ?").get(state.collectionId) as { count: number }).count;
  const totalResponses = (database.prepare("SELECT COUNT(*) as count FROM responses WHERE collection_id = ?").get(state.collectionId) as { count: number }).count;

  const bySection = database
    .prepare("SELECT section, COUNT(DISTINCT participant_id) as participants, COUNT(*) as answers FROM responses WHERE collection_id = ? GROUP BY section")
    .all(state.collectionId) as Array<{ section: SectionId; participants: number; answers: number }>;

  const ratings = database
    .prepare(`
      SELECT question_key as questionKey, value, COUNT(*) as count
      FROM responses
      WHERE collection_id = ? AND section IN ('demand', 'classification') AND question_key LIKE '%rating%'
      GROUP BY question_key, value
      ORDER BY question_key, CAST(value AS INTEGER)
    `)
    .all(state.collectionId) as Array<{ questionKey: string; value: string; count: number }>;

  const categories = database
    .prepare(`
      SELECT question_key as questionKey, value, COUNT(*) as count
      FROM responses
      WHERE collection_id = ? AND section IN ('context', 'classification', 'governance')
        AND question_key NOT LIKE '%comment'
        AND question_key NOT LIKE '%justification'
        AND question_key NOT LIKE '%suggestion'
        AND question_key NOT LIKE '%missing%'
      GROUP BY question_key, value
      ORDER BY question_key, count DESC
    `)
    .all(state.collectionId) as Array<{ questionKey: string; value: string; count: number }>;

  const customScenarios = database
    .prepare(`
      SELECT
        scenario.participant_id as participantId,
        scenario.value as scenario,
        rating.value as rating
      FROM responses scenario
      LEFT JOIN responses rating
        ON rating.collection_id = scenario.collection_id
        AND rating.participant_id = scenario.participant_id
        AND rating.question_key = 'custom_classroom_scenario_rating'
      WHERE scenario.collection_id = ?
        AND scenario.section = 'demand'
        AND scenario.question_key = 'custom_classroom_scenario'
      ORDER BY scenario.created_at
    `)
    .all(state.collectionId) as Array<{ participantId: string; scenario: string; rating: string | null }>;

  return {
    state,
    totalParticipants,
    totalResponses,
    bySection,
    ratings,
    categories,
    customScenarios,
    generatedAt: new Date().toISOString()
  };
}

export function listCollections() {
  return getDb()
    .prepare(`
      SELECT
        c.id,
        c.name,
        c.created_at as createdAt,
        COUNT(DISTINCT p.id) as participants,
        COUNT(r.id) as responses
      FROM collections c
      LEFT JOIN participants p ON p.collection_id = c.id
      LEFT JOIN responses r ON r.collection_id = c.id AND r.participant_id = p.id
      GROUP BY c.id
      ORDER BY c.id DESC
    `)
    .all() as Array<{ id: number; name: string; createdAt: string; participants: number; responses: number }>;
}

export function getCsvRows(collectionId?: number) {
  const sql = `
      SELECT
        c.id as collection_id,
        c.name as collection_name,
        c.created_at as collection_created_at,
        p.id as participant_id,
        CASE WHEN p.pseudonym_hash IS NULL THEN 'no' ELSE 'yes' END as has_pseudonym,
        p.created_at as participant_created_at,
        r.section,
        r.question_key,
        r.value,
        r.comment,
        r.created_at,
        r.updated_at
      FROM collections c
      LEFT JOIN participants p ON p.collection_id = c.id
      LEFT JOIN responses r ON r.collection_id = c.id AND r.participant_id = p.id
      ${collectionId ? "WHERE c.id = ?" : ""}
      ORDER BY c.id, p.created_at, r.section, r.question_key
    `;
  const statement = getDb().prepare(sql);
  return (collectionId ? statement.all(collectionId) : statement.all()) as Array<Record<string, string | null>>;
}

export function startNewCollection() {
  const database = getDb();
  const transaction = database.transaction(() => {
    const result = database
      .prepare("INSERT INTO collections (name) VALUES (?)")
      .run(`Collection ${new Date().toISOString().slice(0, 19).replace("T", " ")}`);
    database
      .prepare("UPDATE survey_state SET current_collection_id = ?, active_section = NULL, accepting_responses = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1")
      .run(Number(result.lastInsertRowid));
  });
  transaction();
  return getSurveyState();
}
