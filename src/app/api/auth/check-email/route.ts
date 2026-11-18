import {NextResponse} from "next/server";
import {findUserByEmail} from "@/lib/sql";
import {ensureSetup} from "@/lib/setup";
import {EMAIL_INVALID_MESSAGE, isValidEmail, normalizeEmail} from "@/lib/validation";

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";

    if (!email) {
        return NextResponse.json({error: "Email is required", field: "email"}, {status: 400});
    }
    if (!isValidEmail(email)) {
        return NextResponse.json({error: EMAIL_INVALID_MESSAGE, field: "email"}, {status: 400});
    }

    try {
        await ensureSetup();
        return NextResponse.json({exists: !!findUserByEmail(email)}, {status: 200});
    } catch (e) {
        console.error("SQL error:", e);
        return NextResponse.json({error: "Database error"}, {status: 500});
    }
}
