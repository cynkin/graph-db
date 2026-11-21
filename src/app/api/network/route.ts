import {NextResponse} from "next/server";
import {currentUserId} from "@/lib/auth";
import {getNetwork} from "@/lib/graph";

// GET /api/network -> every other user with degree, mutual count and request status.
// `meta.queryMs` is the measured time of the Cypher round trip, shown in the page headers.
export async function GET() {
    const me = await currentUserId();
    if (!me) return NextResponse.json({error: "Unauthorized"}, {status: 401});

    try {
        const started = performance.now();
        const users = await getNetwork(me);
        const queryMs = Math.max(1, Math.round(performance.now() - started));
        return NextResponse.json({users, meta: {queryMs}});
    } catch (e) {
        console.error("Network error:", e);
        return NextResponse.json({error: "Failed to load network"}, {status: 500});
    }
}
