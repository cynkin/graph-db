import neo4j, {Driver} from "neo4j-driver";

// Credentials come from .env.local (see .env.example). Never hard-code them.
const NEO4J_URI = process.env.NEO4J_URI ?? "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER ?? "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? "";

// Reuse one driver across hot reloads in development.
const globalForNeo4j = globalThis as unknown as {neo4jDriver?: Driver; schemaReady?: Promise<void>};

export const driver: Driver =
    globalForNeo4j.neo4jDriver ??
    neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD), {disableLosslessIntegers: true});

if (process.env.NODE_ENV !== "production") globalForNeo4j.neo4jDriver = driver;

/** Runs a parameterised Cypher query in its own short-lived session. */
export async function runQuery(cypher: string, params: Record<string, unknown> = {}) {
    await ensureSchema();
    const session = driver.session();
    try {
        return await session.run(cypher, params);
    } finally {
        await session.close();
    }
}

/** Uniqueness constraint on the user id (also creates its index). Runs once per server process. */
function ensureSchema() {
    globalForNeo4j.schemaReady ??= (async () => {
        const session = driver.session();
        try {
            await session.run("CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE");
        } finally {
            await session.close();
        }
    })().catch((e) => {
        globalForNeo4j.schemaReady = undefined; // retry on next query
        throw e;
    });
    return globalForNeo4j.schemaReady;
}
