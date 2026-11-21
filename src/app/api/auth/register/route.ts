import {runQuery} from "@/lib/db";
import {NextResponse} from "next/server";
import {hashPassword} from "@/lib/hash";
import {deleteUser, findUserByEmail, insertUser} from "@/lib/sql";
import {ensureSetup} from "@/lib/setup";
import {isValidEmail, normalizeEmail, EMAIL_INVALID_MESSAGE} from "@/lib/validation";
import {randomUUID} from "crypto";

// Emails listed in ADMIN_EMAILS (comma separated) get the admin role when they register.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!isValidEmail(email)) {
        return NextResponse.json({error: EMAIL_INVALID_MESSAGE, field: "email"}, {status: 400});
    }
    if (name.length < 3 || name.length > 60) {
        return NextResponse.json({error: "Name must be 3-60 characters", field: "name"}, {status: 400});
    }
    if (password.length < 6 || password.length > 64) {
        return NextResponse.json({error: "Password must be 6-64 characters", field: "password"}, {status: 400});
    }
    await ensureSetup().catch(() => {});
    if (findUserByEmail(email)) {
        return NextResponse.json({error: "An account with this email already exists", field: "email"}, {status: 409});
    }

    const id = randomUUID();
    const role = ADMIN_EMAILS.includes(email) ? "admin" : "user";
    try {
        // 1. Credentials -> relational DB (UNIQUE(email) guards against races).
        insertUser(id, email, await hashPassword(password), role);
    } catch (e) {
        if (String(e).includes("UNIQUE")) {
            return NextResponse.json({error: "An account with this email already exists", field: "email"}, {status: 409});
        }
        console.error("Register (SQL) error:", e);
        return NextResponse.json({error: "Could not create account"}, {status: 500});
    }

    // Admins don't join the network, so they get no graph node.
    if (role === "admin") return NextResponse.json({success: true}, {status: 201});

    try {
        // 2. Profile node -> graph DB, sharing the same id.
        await runQuery(`CREATE (:User {id: $id, name: $name, createdAt: datetime()})`, {id, name});
    } catch (e) {
        deleteUser(id); // keep the two databases consistent
        console.error("Register (graph) error:", e);
        return NextResponse.json({error: "Could not create account"}, {status: 500});
    }

    return NextResponse.json({success: true}, {status: 201});
}
