import * as SQLite from "expo-sqlite";

export type TrackingSample = {
  sample_id: string;
  latitud: number;
  longitud: number;
  timestamp_frontend: string;
};

type QueuedSample = {
  sample_id: string;
  payload: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync("tracking.db").then(
      async (database) => {
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS tracking_location_queue (
            sample_id TEXT PRIMARY KEY NOT NULL,
            assignment_id INTEGER NOT NULL,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_tracking_queue_assignment
          ON tracking_location_queue (assignment_id, created_at);
        `);
        return database;
      },
    );
  }
  return databasePromise;
}

export async function enqueueTrackingSample(
  assignmentId: number,
  sample: TrackingSample,
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR IGNORE INTO tracking_location_queue
      (sample_id, assignment_id, payload, created_at) VALUES (?, ?, ?, ?)`,
    sample.sample_id,
    assignmentId,
    JSON.stringify(sample),
    Date.now(),
  );
}

export async function getPendingTrackingSamples(
  assignmentId: number,
): Promise<TrackingSample[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<QueuedSample>(
    `SELECT sample_id, payload FROM tracking_location_queue
      WHERE assignment_id = ? ORDER BY created_at, rowid`,
    assignmentId,
  );
  return rows.map(({ payload }) => JSON.parse(payload) as TrackingSample);
}

export async function acknowledgeTrackingSample(
  assignmentId: number,
  sampleId: string,
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    "DELETE FROM tracking_location_queue WHERE assignment_id = ? AND sample_id = ?",
    assignmentId,
    sampleId,
  );
}
