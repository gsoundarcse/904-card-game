import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// One SQLite file for everything that must survive a restart — user accounts
// and match results. Deliberately separate from the in-memory thinnai rooms
// (lib/server/rooms.ts), which reset by design (see that file's header).
const DB_PATH = process.env.APP_DB_PATH ?? path.join(process.cwd(), 'data', 'app.db')

function openDatabase(): DatabaseSync {
  mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const database = new DatabaseSync(DB_PATH)
  // Next's build collects route data across several worker processes, all of
  // which open this same file and race to run the CREATE TABLE statements
  // below. A busy timeout (set first, before anything that needs a lock)
  // makes them wait their turn instead of erroring with "database is locked".
  database.exec('PRAGMA busy_timeout = 5000')
  database.exec('PRAGMA journal_mode = WAL')
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      seat_count INTEGER NOT NULL,
      rounds_played INTEGER NOT NULL,
      final_claim INTEGER NOT NULL,
      winning_team INTEGER NOT NULL,
      ended_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS match_players (
      match_id TEXT NOT NULL,
      seat INTEGER NOT NULL,
      team INTEGER NOT NULL,
      name TEXT NOT NULL,
      user_id TEXT,
      won INTEGER NOT NULL,
      FOREIGN KEY (match_id) REFERENCES matches (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
    CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players (match_id);
    CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players (user_id);
  `)
  return database
}

const globalStore = globalThis as unknown as { __appDb?: DatabaseSync }
export const db: DatabaseSync = (globalStore.__appDb ??= openDatabase())
