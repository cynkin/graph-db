// Resets the sample network.  Run:  npm run seed
// (The app also loads it automatically the first time it starts with an empty database.)
//   - credentials  -> SQLite  (data/app.db, table users)
//   - people/links -> Neo4j   (:User nodes, CONNECTED / REQUESTED relationships)
// Only touches sample users (emails ending in @demo.test) and makes sure the admin account exists.
import neo4j from "neo4j-driver";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import {randomUUID} from "crypto";

const demo = JSON.parse(fs.readFileSync(new URL("./demo-data.json", import.meta.url), "utf8"));
const ADMIN_EMAIL = (process.env.DEFAULT_ADMIN_EMAIL ?? "admin@gmail.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD ?? "admin123";
const email = (name) => `${name.toLowerCase()}@demo.test`;

// --- SQLite ---------------------------------------------------------------
const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), "data", "app.db");
fs.mkdirSync(path.dirname(dbPath), {recursive: true});
const sql = new Database(dbPath);
sql.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

// --- Neo4j ----------------------------------------------------------------
const driver = neo4j.driver(
    process.env.NEO4J_URI ?? "bolt://localhost:7687",
    neo4j.auth.basic(process.env.NEO4J_USER ?? "neo4j", process.env.NEO4J_PASSWORD ?? "")
);
const session = driver.session();

try {
    await session.run("CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE");

    // Remove previous sample data from both databases.
    const oldIds = sql.prepare("SELECT id FROM users WHERE email LIKE '%@demo.test'").all().map((r) => r.id);
    await session.run("MATCH (u:User) WHERE u.id IN $ids DETACH DELETE u", {ids: oldIds});
    sql.prepare("DELETE FROM users WHERE email LIKE '%@demo.test'").run();

    const hash = await bcrypt.hash(demo.password, 10);
    const people = demo.people.map((name) => ({id: randomUUID(), name}));
    const idOf = Object.fromEntries(people.map((p) => [p.name, p.id]));

    await session.run(`UNWIND $people AS p CREATE (:User {id: p.id, name: p.name, createdAt: datetime()})`, {people});
    await session.run(
        `UNWIND $pairs AS pair MATCH (a:User {id: pair[0]}), (b:User {id: pair[1]}) MERGE (a)-[:CONNECTED]-(b)`,
        {pairs: demo.connected.map(([a, b]) => [idOf[a], idOf[b]])}
    );
    await session.run(
        `UNWIND $pairs AS pair MATCH (a:User {id: pair[0]}), (b:User {id: pair[1]}) MERGE (a)-[:REQUESTED]->(b)`,
        {pairs: demo.requested.map(([a, b]) => [idOf[a], idOf[b]])}
    );

    const insert = sql.prepare("INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)");
    sql.transaction(() => {
        for (const p of people) insert.run(p.id, email(p.name), hash, "user");
    })();

    // Admin account: SQLite only (admins are not part of the network).
    if (!sql.prepare("SELECT 1 FROM users WHERE email = ?").get(ADMIN_EMAIL)) {
        insert.run(randomUUID(), ADMIN_EMAIL, await bcrypt.hash(ADMIN_PASSWORD, 10), "admin");
    }

    console.log(`Seeded ${people.length} sample users (password ${demo.password}). Admin: ${ADMIN_EMAIL}`);
} catch (e) {
    console.error("Seed failed:", e.message);
    process.exitCode = 1;
} finally {
    await session.close();
    await driver.close();
    sql.close();
}
