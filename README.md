# GraphNet

A LinkedIn-style professional network built around a **graph database**. Users sign up,
send connection requests, and see their network as **1st, 2nd and 3rd degree connections**
with **mutual connections**, all computed by graph queries in Neo4j.

Login data goes in a **relational database** (SQLite) and the social graph goes in a
**graph database** (Neo4j), so each database does the job it is best at.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 15](https://nextjs.org) (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, lucide-react icons |
| Graph database | [Neo4j 5](https://neo4j.com), queried with Cypher through `neo4j-driver` |
| Relational database | [SQLite](https://sqlite.org), through `better-sqlite3` |
| Authentication | NextAuth.js (credentials provider, JWT sessions), bcrypt password hashing |
| Client state | Zustand (multi-step sign-in form) |

---

## Database schema and relation design

```
        SQLite (relational)                         Neo4j (graph)
 ┌────────────────────────────────┐        ┌───────────────────────────────┐
 │ users                          │        │ (:User {id, name, createdAt}) │
 │  id            TEXT  PK  ──────┼─ same ─┼─► id                          │
 │  email         TEXT  UNIQUE    │   id   │                               │
 │  password_hash TEXT            │        │ (:User)-[:CONNECTED]-(:User)  │
 │  role          TEXT  user|admin│        │ (:User)-[:REQUESTED]->(:User) │
 │  created_at    TEXT            │        └───────────────────────────────┘
 └────────────────────────────────┘
```

### Relational side: SQLite

The `users` table holds only what is needed to log in. Its structure is fixed and it needs
uniqueness and exact lookups, which is what a relational table does well.

```sql
CREATE TABLE users (
    id            TEXT PRIMARY KEY,                -- UUID, shared with the Neo4j node
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,                   -- bcrypt hash, never sent to the browser
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Graph side: Neo4j

| Element | Meaning |
|---|---|
| `(:User {id, name, createdAt})` | A person's public profile. `id` is unique (constraint `user_id`). |
| `(a)-[:REQUESTED]->(b)` | `a` has sent `b` a connection request. It is directed and pending. |
| `(a)-[:CONNECTED]-(b)` | `a` and `b` are connected. It is stored once and matched in both directions. |

How relationships change over time:

```
 (none) ──request──► REQUESTED ──accept──► CONNECTED ──remove──► (none)
                         │
                         └──ignore / withdraw──► (none)
```

If both people send each other a request, they are connected automatically.

### Linking the two databases

Both databases use the same UUID as the key: `users.id` (SQLite) = `User.id` (Neo4j).

- **Sign up:** a row is added to SQLite, then a node is created in Neo4j. If the Neo4j step
  fails, the SQLite row is removed again so the two stay in sync.
- **Sign in:** the email and password are checked in SQLite, then the display name is read
  from the Neo4j node with the same id.
- **Admins** exist only in SQLite. They manage the databases and are not part of the network.

### Key graph queries (`src/lib/graph.ts`)

**Degree of connection.** Checks 1-, 2- and 3-hop paths in order:

```cypher
CASE
  WHEN EXISTS { (me)-[:CONNECTED]-(u) }                                         THEN 1
  WHEN EXISTS { (me)-[:CONNECTED]-(:User)-[:CONNECTED]-(u) }                    THEN 2
  WHEN EXISTS { (me)-[:CONNECTED]-(:User)-[:CONNECTED]-(:User)-[:CONNECTED]-(u) } THEN 3
END AS degree
```

**Mutual connections:**

```cypher
MATCH (me:User {id: $me})-[:CONNECTED]-(m:User)-[:CONNECTED]-(them:User {id: $them})
RETURN DISTINCT m
```

---

## Login details

The app loads a **sample network automatically** the first time it starts with an empty database,
so you can sign in right away. Every account below is ready to use.

### Admin

| Email | Password | What it can do |
|---|---|---|
| `admin@gmail.com` | `admin123` | Sees the databases directly; it is not part of the network |

The admin goes straight to the **Admin** page, which shows:

- the live **Neo4j graph**, which you can explore by dragging nodes around
- the **SQLite `users` table** (`id`, `email`, `created_at`). It lists the network's members
  only — the admin account is not a row of it — and password hashes are never shown.

The admin account exists only in SQLite (`role = 'admin'`) and has no `:User` node, so it
never shows up in anyone's network and can't send or accept connection requests.

> Change this password before putting the app anywhere public. To use different
> credentials, set `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD` in `.env.local`
> before the first run.

### Sample users

All sample users have the password **`Demo@123`**.

| Name | Email | Connected to | Notes |
|---|---|---|---|
| Alice | `alice@demo.test` | Bob, Carol | Has a pending request from Ivan. **Best account to start with.** |
| Bob | `bob@demo.test` | Alice, Carol, Dave | |
| Carol | `carol@demo.test` | Alice, Bob, Dave | |
| Dave | `dave@demo.test` | Bob, Carol, Eve | |
| Eve | `eve@demo.test` | Dave, Frank | |
| Frank | `frank@demo.test` | Eve | |
| Grace | `grace@demo.test` | Heidi | A separate group, unconnected to the others |
| Heidi | `heidi@demo.test` | Grace | |
| Ivan | `ivan@demo.test` | (nobody yet) | Has sent Alice a connection request |

Signed in as **Alice**, you'll see:

| Degree | People | Why |
|---|---|---|
| 1st | Bob, Carol | Directly connected |
| 2nd | Dave (2 mutual) | Connected through Bob and through Carol |
| 3rd | Eve | Alice → Bob → Dave → Eve |
| Outside network | Frank, Grace, Heidi | More than 3 steps away, or no path at all |
| Invitation | Ivan | Ivan → Alice request is pending |

---

## Setup

### Prerequisites

- **Node.js 22 or newer** (check with `node -v`; older versions crash the SQLite driver)
- **Neo4j 5**, using either option below:
  - [Neo4j Desktop](https://neo4j.com/download/): create a local database, set a password, and start it.
  - Docker:
    ```bash
    docker run -d --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/your-password neo4j:5
    ```

SQLite needs no installation. The database file `data/app.db` is created automatically.

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create the environment file.** Copy the example:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local`:
   | Variable | Value |
   |---|---|
   | `NEO4J_URI` | `bolt://localhost:7687` (default) |
   | `NEO4J_USER` | `neo4j` |
   | `NEO4J_PASSWORD` | the password you set for Neo4j |
   | `NEXTAUTH_SECRET` | any long random string, e.g. from `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | `http://localhost:3000` |

3. **Start the app**
   ```bash
   npm run dev
   ```
   Open **http://localhost:3000**. On first start, the sample users and the admin account are
   created automatically (see [Login details](#login-details)). Sign in with any of them,
   or register a new user.

To reset the sample network to its original state at any time, run `npm run seed`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Make a production build and run it |
| `npm run seed` | Reset the sample users to their original state (only touches `@demo.test` accounts) |
| `npm run lint` | Run ESLint |

---

## Registering as a user

1. Open http://localhost:3000. You'll be taken to the sign-in page.
2. Enter your **email** and click **Continue**.
3. Because the email is new, you are asked to **create a password**: 6 to 64 characters,
   using a mix of letters, numbers and symbols.
4. Enter your **full name** (3 to 60 characters) and click **Continue**.
5. You're signed in and taken to **My network**.

To sign in later, enter the same email. Because it already exists, you'll go straight to the password step.

### Using the network

- **Connect:** send a connection request to anyone.
- **Invitations:** requests sent to you appear at the top. **Accept** or **Ignore** them.
- **Degrees:** people are grouped into 1st, 2nd and 3rd degree, with a count of mutual connections.
- **Profile:** click a name to see your mutual connections with that person. Their full
  connection list is shown only if they are your 1st-degree connection.
- **Search:** find people by name on the **Discover** page.
- **My connections:** in the profile menu, shows your own connection list.

See [Login details](#login-details) for accounts to try this with.

---

## Project structure

```
src/
  app/
    page.tsx               My network (1st / 2nd / 3rd degree)
    connections/           Profile page: mutual connections and their connections
    admin/                 Admin page: graph view and users table
    auth/                  Sign in / register pages
    api/
      auth/                Sign in, register, email check
      network/             GET   network with degrees and mutual counts
      profile/             GET   one user's profile, mutuals and connections
      connections/         POST  request / accept / ignore / remove
      admin/               GET   whole graph and users table (admin only)
  lib/
    sql.ts                 SQLite: users table
    db.ts                  Neo4j driver
    graph.ts               All Cypher queries
    auth.ts                NextAuth configuration
    setup.ts               First run: sample network and admin account
  components/              UI (PersonRow, GraphView, ...)
scripts/demo-data.json     Sample users and connections
scripts/seed.mjs           Resets the sample network
```

---

## Security

- Passwords are hashed with bcrypt and stored only in SQLite. They are never sent to the browser.
- Every SQL and Cypher query is parameterised, so injection is not possible.
- Every network, profile and connection API requires a signed-in user. The admin API also
  requires `role = 'admin'`.
- Secrets live in `.env.local`, which git ignores, not in the source code.
