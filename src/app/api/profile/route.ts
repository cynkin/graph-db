import {NextRequest, NextResponse} from "next/server";
import {currentUserId} from "@/lib/auth";
import {getProfile} from "@/lib/graph";

// GET /api/profile?user_id=... -> the user, our mutual connections, and their connections (if visible).
export async function GET(req: NextRequest) {
    const me = await currentUserId();
    if (!me) return NextResponse.json({error: "Unauthorized"}, {status: 401});

    const userId = req.nextUrl.searchParams.get("user_id");
    if (!userId) return NextResponse.json({error: "user_id is required"}, {status: 400});

    try {
        const profile = await getProfile(me, userId);
        if (!profile) return NextResponse.json({error: "User not found"}, {status: 404});
        return NextResponse.json(profile);
    } catch (e) {
        console.error("Profile error:", e);
        return NextResponse.json({error: "Failed to load profile"}, {status: 500});
    }
}
