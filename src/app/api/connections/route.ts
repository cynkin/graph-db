import {NextResponse} from "next/server";
import {currentUserId} from "@/lib/auth";
import {removeConnection, requestConnection, respondToRequest} from "@/lib/graph";

// POST /api/connections  { action: "request" | "accept" | "ignore" | "remove", user_id }
export async function POST(req: Request) {
    const me = await currentUserId();
    if (!me) return NextResponse.json({error: "Unauthorized"}, {status: 401});

    const body = await req.json().catch(() => ({}));
    const userId = typeof body.user_id === "string" ? body.user_id : "";
    const action = body.action;
    if (!userId) return NextResponse.json({error: "user_id is required"}, {status: 400});
    if (userId === me) return NextResponse.json({error: "Cannot connect to yourself"}, {status: 400});

    try {
        let ok: boolean;
        switch (action) {
            case "request":
                ok = (await requestConnection(me, userId)) !== null;
                break;
            case "accept":
            case "ignore":
                ok = await respondToRequest(me, userId, action === "accept");
                break;
            case "remove":
                ok = await removeConnection(me, userId);
                break;
            default:
                return NextResponse.json({error: "Unknown action"}, {status: 400});
        }
        if (!ok) return NextResponse.json({error: "Nothing to update"}, {status: 409});
        return NextResponse.json({success: true});
    } catch (e) {
        console.error("Connection error:", e);
        return NextResponse.json({error: "Failed to update connection"}, {status: 500});
    }
}
