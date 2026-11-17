import { databasePool } from "./mysql";
import { migrations } from "./migrations";
import type { RowDataPacket } from "mysql2/promise";

// Explicit finite CLI. Never imported by application startup and never seeds data.
async function migrate() {
  const pool = databasePool();
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [lock] = await connection.execute<RowDataPacket[]>("SELECT GET_LOCK('forsa_schema_migrations', 15) AS acquired");
    if (Number(lock[0].acquired) !== 1) throw new Error("Migration lock unavailable");
    locked = true;
    await connection.execute(`CREATE TABLE IF NOT EXISTS forsa_schema_migrations (
      version INT UNSIGNED PRIMARY KEY, name VARCHAR(120) NOT NULL,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    for (const migration of migrations) {
      const [existing] = await connection.execute<RowDataPacket[]>("SELECT version FROM forsa_schema_migrations WHERE version=?", [migration.version]);
      if (existing.length) { console.log(`Forsa migration ${migration.version}: already applied`); continue; }
      // MySQL DDL commits implicitly. Each statement is additive/repeatable; record only after all succeed.
      for (const statement of migration.statements) await connection.execute(statement);
      await connection.execute("INSERT INTO forsa_schema_migrations (version,name) VALUES (?,?)", [migration.version, migration.name]);
      console.log(`Forsa migration ${migration.version}: applied`);
    }
  } finally {
    if (locked) await connection.execute("SELECT RELEASE_LOCK('forsa_schema_migrations')").catch(() => {});
    connection.release();
    await pool.end();
  }
}
migrate().catch(() => { console.error("Forsa migration failed. Check database connectivity/schema permissions; no secrets logged."); process.exitCode = 1; });
