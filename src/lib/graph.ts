/*
 * All the graph queries the app uses, in one place.
 *
 * Data model (login credentials live in SQLite, see src/lib/sql.ts)
 *   (:User {id, name})
 *   (:User)-[:REQUESTED]->(:User)   pending connection request (directed)
 *   (:User)-[:CONNECTED]-(:User)    accepted connection (stored once, queried undirected)
 *
 * Degree = length of the shortest CONNECTED path between two users (1st, 2nd, 3rd),
 * found by checking 1-, 2- and 3-hop patterns in order.
 */
import {runQuery} from "@/lib/db";

export type Status = "self" | "connected" | "sent" | "received" | "none";

export type Person = {
    id: string;
    name: string;
    degree: number | null; // 1, 2, 3 or null (outside 3 hops / not connected)
    mutual: number;        // number of mutual 1st-degree connections with the viewer
    status: Status;
};

// Reusable Cypher fragment: given `me` and `u`, computes degree, mutual count and status.
const PERSON_FIELDS = `
    WITH me, u, CASE
        WHEN me = u THEN 0
        WHEN EXISTS { (me)-[:CONNECTED]-(u) } THEN 1
        WHEN EXISTS { (me)-[:CONNECTED]-(:User)-[:CONNECTED]-(u) } THEN 2
        WHEN EXISTS { (me)-[:CONNECTED]-(:User)-[:CONNECTED]-(:User)-[:CONNECTED]-(u) } THEN 3
        ELSE null
      END AS degree
    OPTIONAL MATCH (me)-[:CONNECTED]-(m:User)-[:CONNECTED]-(u)
    WHERE m <> me AND m <> u
    WITH me, u, degree, count(DISTINCT m) AS mutual
    RETURN u.id AS id, u.name AS name, degree, mutual,
           CASE
             WHEN me = u THEN 'self'
             WHEN EXISTS { (me)-[:CONNECTED]-(u) } THEN 'connected'
             WHEN EXISTS { (me)-[:REQUESTED]->(u) } THEN 'sent'
             WHEN EXISTS { (u)-[:REQUESTED]->(me) } THEN 'received'
             ELSE 'none'
           END AS status`;

function toPerson(r: {toObject(): Record<string, unknown>}): Person {
    const o = r.toObject();
    return {
        id: o.id as string,
        name: o.name as string,
        degree: (o.degree as number | null) ?? null,
        mutual: (o.mutual as number) ?? 0,
        status: o.status as Status,
    };
}

/** Everyone except me, with degree, mutual count and request status. */
export async function getNetwork(meId: string): Promise<Person[]> {
    const res = await runQuery(
        `MATCH (me:User {id: $meId})
         MATCH (u:User) WHERE u <> me
         ${PERSON_FIELDS}
         ORDER BY coalesce(degree, 99), mutual DESC, toLower(name)`,
        {meId}
    );
    return res.records.map(toPerson);
}

/** Profile of one user as seen by me: the person, our mutual connections, and their connections. */
export async function getProfile(meId: string, userId: string) {
    const personRes = await runQuery(
        `MATCH (me:User {id: $meId}), (u:User {id: $userId}) ${PERSON_FIELDS}`,
        {meId, userId}
    );
    if (personRes.records.length === 0) return null;
    const person = toPerson(personRes.records[0]);

    const mutualRes = await runQuery(
        `MATCH (me:User {id: $meId})-[:CONNECTED]-(u:User)-[:CONNECTED]-(them:User {id: $userId})
         WHERE u <> me AND u <> them
         WITH DISTINCT me, u
         ${PERSON_FIELDS}
         ORDER BY toLower(name)`,
        {meId, userId}
    );
    const mutual = mutualRes.records.map(toPerson);

    // Like LinkedIn: a full connection list is only visible for yourself and your 1st-degree connections.
    let connections: Person[] | null = null;
    if (person.status === "self" || person.status === "connected") {
        const connRes = await runQuery(
            `MATCH (me:User {id: $meId}), (them:User {id: $userId})-[:CONNECTED]-(u:User)
             WITH DISTINCT me, u
             ${PERSON_FIELDS}
             ORDER BY coalesce(degree, 99), toLower(name)`,
            {meId, userId}
        );
        connections = connRes.records.map(toPerson);
    }

    return {person, mutual, connections};
}

/**
 * Send a connection request. If the other user already requested me, this accepts it instead.
 * Returns the new status, or null if the user doesn't exist / is me / we're already connected.
 */
export async function requestConnection(meId: string, userId: string): Promise<Status | null> {
    const res = await runQuery(
        `MATCH (me:User {id: $meId}), (u:User {id: $userId})
         WHERE me <> u AND NOT EXISTS { (me)-[:CONNECTED]-(u) }
         OPTIONAL MATCH (u)-[incoming:REQUESTED]->(me)
         FOREACH (_ IN CASE WHEN incoming IS NULL THEN [1] ELSE [] END | MERGE (me)-[:REQUESTED]->(u))
         FOREACH (_ IN CASE WHEN incoming IS NULL THEN [] ELSE [1] END | MERGE (me)-[:CONNECTED]-(u))
         DELETE incoming
         RETURN CASE WHEN incoming IS NULL THEN 'sent' ELSE 'connected' END AS status`,
        {meId, userId}
    );
    return (res.records[0]?.get("status") as Status) ?? null;
}

/** Accept or ignore a request that `userId` sent to me. Returns false if no such request exists. */
export async function respondToRequest(meId: string, userId: string, accept: boolean): Promise<boolean> {
    const res = await runQuery(
        `MATCH (u:User {id: $userId})-[r:REQUESTED]->(me:User {id: $meId})
         DELETE r
         FOREACH (_ IN CASE WHEN $accept THEN [1] ELSE [] END | MERGE (u)-[:CONNECTED]-(me))
         RETURN count(*) AS n`,
        {meId, userId, accept}
    );
    return (res.records[0]?.get("n") ?? 0) > 0;
}

/** Withdraw a request I sent, or remove an existing connection. */
export async function removeConnection(meId: string, userId: string): Promise<boolean> {
    const res = await runQuery(
        `MATCH (me:User {id: $meId}), (u:User {id: $userId})
         OPTIONAL MATCH (me)-[c:CONNECTED]-(u)
         OPTIONAL MATCH (me)-[r:REQUESTED]->(u)
         WITH collect(DISTINCT c) + collect(DISTINCT r) AS rels
         FOREACH (x IN rels | DELETE x)
         RETURN size(rels) AS n`,
        {meId, userId}
    );
    return (res.records[0]?.get("n") ?? 0) > 0;
}

/** Admin view: every node and relationship in the graph. */
export async function getWholeGraph() {
    const nodes = await runQuery(`MATCH (u:User) RETURN u.id AS id, u.name AS name ORDER BY toLower(u.name)`);
    const links = await runQuery(
        `MATCH (a:User)-[r:CONNECTED|REQUESTED]->(b:User)
         RETURN a.id AS source, b.id AS target, type(r) AS type`
    );
    return {
        nodes: nodes.records.map((r) => r.toObject() as {id: string; name: string}),
        links: links.records.map((r) => r.toObject() as {source: string; target: string; type: "CONNECTED" | "REQUESTED"}),
    };
}
