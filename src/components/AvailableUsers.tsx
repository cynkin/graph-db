'use client';
import {useCallback, useEffect, useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "next/link";
import {useSession} from "next-auth/react";
import PersonRow, {PeopleCard, Person} from "@/components/PersonRow";

const SECTIONS: {title: string; hint: string; filter: (p: Person) => boolean}[] = [
    {title: "1st degree connections", hint: "People you are connected to", filter: (p) => p.degree === 1},
    {title: "2nd degree connections", hint: "Connections of your connections", filter: (p) => p.degree === 2},
    {title: "3rd degree connections", hint: "One step further out", filter: (p) => p.degree === 3},
    {title: "Outside your network", hint: "No path within 3 connections", filter: (p) => p.degree === null},
];

function Stat({label, value, color}: {label: string; value: number; color: string}) {
    return (
        <div className="flex-1 min-w-[110px] rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
        </div>
    );
}

export default function AvailableUsers() {
    const q = (useSearchParams().get("q") ?? "").trim().toLowerCase();
    const {data: session} = useSession();
    const [users, setUsers] = useState<Person[] | null>(null);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        const res = await fetch("/api/network", {cache: "no-store"});
        if (!res.ok) {
            setError("Could not load your network. Is Neo4j running?");
            return;
        }
        setError("");
        setUsers((await res.json()).users);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    if (error) return <div className="m-5 text-red-500">{error}</div>;
    if (!users) return <div className="m-5 text-gray-500">Loading your network...</div>;

    // When searching, show every match; otherwise invitations get their own card at the top.
    const visible = q
        ? users.filter((u) => u.name.toLowerCase().includes(q))
        : users.filter((u) => u.status !== "received");
    const invitations = users.filter((u) => u.status === "received");
    const count = (d: number) => users.filter((u) => u.degree === d).length;
    const firstName = session?.user?.name?.split(" ")[0] ?? "";

    return (
        <div className="my-6 max-w-3xl">
            {!q && <>
                <div className="mb-5">
                    <div className="text-3xl font-bold">My network</div>
                    <div className="text-gray-600">
                        Welcome back{firstName && `, ${firstName}`}.{" "}
                        {session?.user?.id &&
                            <Link href={`/connections?user_id=${encodeURIComponent(session.user.id)}`}
                                  className="text-[#1568e3] hover:underline">See your connections</Link>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-3 mb-6">
                    <Stat label="1st degree" value={count(1)} color="text-[#5423e7]"/>
                    <Stat label="2nd degree" value={count(2)} color="text-[#1568e3]"/>
                    <Stat label="3rd degree" value={count(3)} color="text-sky-700"/>
                    <Stat label="Invitations" value={invitations.length} color="text-gray-800"/>
                </div>
            </>}

            {invitations.length > 0 && !q &&
                <PeopleCard title={`Invitations (${invitations.length})`} hint="People who want to connect with you">
                    {invitations.map((u) => <PersonRow key={u.id} person={u} onChange={load}/>)}
                </PeopleCard>}

            {q && <div className="mb-4 text-lg">Results for &quot;{q}&quot; <span className="text-gray-500">({visible.length})</span></div>}
            {q && visible.length === 0 && <div className="text-gray-600">No one found.</div>}
            {users.length === 0 && <div className="text-gray-600">No other users yet. Ask a friend to sign up!</div>}

            {SECTIONS.map(({title, hint, filter}) => {
                const list = visible.filter(filter);
                if (list.length === 0) return null;
                return (
                    <PeopleCard key={title} title={`${title} (${list.length})`} hint={hint}>
                        {list.map((u) => <PersonRow key={u.id} person={u} onChange={load}/>)}
                    </PeopleCard>
                );
            })}
        </div>
    );
}
