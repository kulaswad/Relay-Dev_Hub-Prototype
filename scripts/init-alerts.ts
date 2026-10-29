import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  await db.run(sql`CREATE INDEX IF NOT EXISTS alerts_ws_idx ON alerts(workspace_id);`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS alerts_type_idx ON alerts(type);`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS alerts_created_idx ON alerts(created_at);`);

  console.log("Alerts table initialized successfully");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
