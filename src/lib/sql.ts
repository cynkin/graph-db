/*
 * Relational side of the app (SQLite): login credentials only.
 *
 *   users(id PK, email UNIQUE, password_hash, role, created_at)
 *
 * `users.id` is the same UUID as the (:User {id}) node in Neo4j, which holds the
 * profile (name) and all the relationships. Passwords never touch the graph.
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.SQLITE_PATH ?? path.join(process.cwd(), "data", "app.db");

export type UserRow = {
    id: string;
    email: string;
    password_hash: string;
    role: "user" | "admin";
    created_at: string;
};

const globalForSql = globalThis as unknown as {sqlite?: Database.Database};

function open() {
    fs.mkdirSync(path.dirname(DB_PATH), {recursive: true});
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id            TEXT PRIMARY KEY,
            email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        )`);
    return db;
}

export const sql: Database.Database = globalForSql.sqlite ?? open();
if (process.env.NODE_ENV !== "production") globalForSql.sqlite = sql;

export function findUserByEmail(email: string): UserRow | undefined {
    return sql.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

export function insertUser(id: string, email: string, passwordHash: string, role: "user" | "admin" = "user") {
    sql.prepare("INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)").run(id, email, passwordHash, role);
}

export function deleteUser(id: string) {
    sql.prepare("DELETE FROM users WHERE id = ?").run(id);
}

/** For the admin page. The password hash is never sent to the browser. */
export function listUsers() {
    return sql.prepare("SELECT id, email, role, created_at FROM users ORDER BY created_at, email").all() as
        Omit<UserRow, "password_hash">[];
}
