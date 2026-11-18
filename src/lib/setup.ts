/*
 * First-run setup, done once per server process before the first login:
 *   1. Empty database -> load the sample network (scripts/demo-data.json).
 *   2. Make sure the admin account exists: admin@gmail.com / admin123
 *      (override with DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD).
 * The admin only lives in SQLite: it manages the databases and is not part of the network.
 */
import {randomUUID} from "crypto";
import {runQuery} from "@/lib/db";
import {findUserByEmail, insertUser, sql} from "@/lib/sql";
import {hashPassword} from "@/lib/hash";
import demo from "../../scripts/demo-data.json";

const ADMIN_EMAIL = (process.env.DEFAULT_ADMIN_EMAIL ?? "admin@gmail.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD ?? "admin123";

export const demoEmail = (name: string) => `${name.toLowerCase()}@demo.test`;

const globalForSetup = globalThis as unknown as {setupReady?: Promise<void>};

async function seedDemoNetwork() {
    const hash = await hashPassword(demo.password);
    const people = demo.people.map((name) => ({id: randomUUID(), name}));
    const idOf = Object.fromEntries(people.map((p) => [p.name, p.id]));

    await runQuery(`UNWIND $people AS p CREATE (:User {id: p.id, name: p.name, createdAt: datetime()})`, {people});
    await runQuery(
        `UNWIND $pairs AS pair MATCH (a:User {id: pair[0]}), (b:User {id: pair[1]}) MERGE (a)-[:CONNECTED]-(b)`,
        {pairs: demo.connected.map(([a, b]) => [idOf[a], idOf[b]])}
    );
    await runQuery(
        `UNWIND $pairs AS pair MATCH (a:User {id: pair[0]}), (b:User {id: pair[1]}) MERGE (a)-[:REQUESTED]->(b)`,
        {pairs: demo.requested.map(([a, b]) => [idOf[a], idOf[b]])}
    );
    for (const p of people) insertUser(p.id, demoEmail(p.name), hash, "user");
}

export function ensureSetup() {
    globalForSetup.setupReady ??= (async () => {
        const {n} = sql.prepare("SELECT count(*) AS n FROM users").get() as {n: number};
        if (n === 0) await seedDemoNetwork();

        if (!findUserByEmail(ADMIN_EMAIL)) {
            try {
                insertUser(randomUUID(), ADMIN_EMAIL, await hashPassword(ADMIN_PASSWORD), "admin");
            } catch (e) {
                if (!String(e).includes("UNIQUE")) throw e; // created by a parallel request
            }
        }
    })().catch((e) => {
        globalForSetup.setupReady = undefined; // retry on next request
        throw e;
    });
    return globalForSetup.setupReady;
}
