'use client';
import Link from "next/link";
import {useState} from "react";

export type Person = {
    id: string;
    name: string;
    degree: number | null;
    mutual: number;
    status: "self" | "connected" | "sent" | "received" | "none";
};

const DEGREE_LABEL: Record<number, string> = {0: "You", 1: "1st", 2: "2nd", 3: "3rd"};
const DEGREE_STYLE: Record<number, string> = {
    0: "bg-gray-200 text-gray-800",
    1: "bg-[#5423e7] text-white",
    2: "bg-[#1568e3] text-white",
    3: "bg-sky-200 text-sky-900",
};
const AVATAR_STYLE: Record<number, string> = {
    0: "bg-gray-200 text-gray-700",
    1: "bg-[#ede7fd] text-[#5423e7]",
    2: "bg-[#e3eefc] text-[#1568e3]",
    3: "bg-sky-50 text-sky-800",
};

export function DegreeBadge({degree}: {degree: number | null}) {
    if (degree === null) return null; // more than 3 hops away, or not connected at all
    return (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${DEGREE_STYLE[degree]}`}>
            {DEGREE_LABEL[degree]}
        </span>
    );
}

export function Avatar({name, degree, size = "md"}: {name: string; degree: number | null; size?: "md" | "lg"}) {
    const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const dims = size === "lg" ? "w-14 h-14 text-xl" : "w-10 h-10 text-sm";
    return (
        <div className={`${dims} shrink-0 rounded-full flex items-center justify-center font-bold
                         ${degree === null ? "bg-gray-100 text-gray-500" : AVATAR_STYLE[degree]}`}>
            {initials}
        </div>
    );
}

async function post(action: string, userId: string) {
    const res = await fetch("/api/connections", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({action, user_id: userId}),
    });
    return res.ok;
}

const primaryBtn = "cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold bg-[#5423e7] text-white hover:bg-purple-800 disabled:opacity-50";
const outlineBtn = "cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50";

/** Connect / Pending / Accept+Ignore / Remove, depending on the relationship. */
export function ConnectionActions({person, onChange}: {person: Person; onChange: () => void}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const act = async (action: string) => {
        if (action === "remove" && person.status === "connected" && !confirm(`Remove ${person.name} from your connections?`)) return;
        setBusy(true);
        setError("");
        const ok = await post(action, person.id);
        setBusy(false);
        if (!ok) setError("Failed, try again");
        onChange();
    };

    return (
        <div className="flex items-center gap-2 shrink-0">
            {error && <span className="text-xs text-red-500">{error}</span>}
            {person.status === "none" &&
                <button disabled={busy} onClick={() => act("request")} className={primaryBtn}>+ Connect</button>}
            {person.status === "sent" &&
                <button disabled={busy} onClick={() => act("remove")} className={outlineBtn} title="Withdraw request">
                    Pending · Withdraw
                </button>}
            {person.status === "received" && <>
                <button disabled={busy} onClick={() => act("ignore")} className={outlineBtn}>Ignore</button>
                <button disabled={busy} onClick={() => act("accept")} className={primaryBtn}>Accept</button>
            </>}
            {person.status === "connected" &&
                <button disabled={busy} onClick={() => act("remove")}
                        className="cursor-pointer rounded-full px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50">
                    Remove
                </button>}
        </div>
    );
}

function subtitle(p: Person) {
    if (p.status === "self") return "You";
    if (p.status === "received") return "Wants to connect with you";
    if (p.mutual > 0) return `${p.mutual} mutual connection${p.mutual > 1 ? "s" : ""}`;
    if (p.degree === null) return "Not in your network yet";
    return "No mutual connections";
}

export default function PersonRow({person, onChange}: {person: Person; onChange: () => void}) {
    return (
        <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
                <Avatar name={person.name} degree={person.degree}/>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        {person.status === "self"
                            ? <span className="font-semibold truncate">{person.name}</span>
                            : <Link href={`/connections?user_id=${encodeURIComponent(person.id)}`}
                                    className="font-semibold truncate hover:text-[#5423e7] hover:underline">{person.name}</Link>}
                        <DegreeBadge degree={person.degree}/>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{subtitle(person)}</div>
                </div>
            </div>
            <ConnectionActions person={person} onChange={onChange}/>
        </div>
    );
}

/** A titled card holding a list of people. */
export function PeopleCard({title, hint, children}: {title: string; hint?: string; children: React.ReactNode}) {
    return (
        <section className="mb-6 border border-gray-300 rounded-2xl overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="font-bold text-lg">{title}</div>
                {hint && <div className="text-xs text-gray-500">{hint}</div>}
            </div>
            <div className="divide-y divide-gray-100">{children}</div>
        </section>
    );
}
