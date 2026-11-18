'use client';
import {useCallback, useEffect, useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "next/link";
import PersonRow, {Avatar, ConnectionActions, DegreeBadge, PeopleCard, Person} from "@/components/PersonRow";

type Profile = {person: Person; mutual: Person[]; connections: Person[] | null};

export default function UserConnections() {
    const userId = useSearchParams().get("user_id");
    const [profile, setProfile] = useState<Profile | null>(null);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!userId) {
            setError("No user selected.");
            return;
        }
        const res = await fetch(`/api/profile?user_id=${encodeURIComponent(userId)}`, {cache: "no-store"});
        if (!res.ok) {
            setError(res.status === 404 ? "User not found." : "Could not load this profile.");
            return;
        }
        setError("");
        setProfile(await res.json());
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    if (error) return <div className="m-5 text-red-500">{error} <Link href="/" className="text-blue-500">Back</Link></div>;
    if (!profile) return <div className="m-5">Loading...</div>;

    const {person, mutual, connections} = profile;

    const whose = person.status === "self" ? "Your" : `${person.name.split(" ")[0]}'s`;

    return (
        <div className="my-6 max-w-3xl">
            <Link href="/" className="text-[#1568e3] hover:underline text-sm">&larr; My network</Link>

            <div className="flex flex-wrap items-center justify-between gap-4 my-4 p-5 border border-gray-300 rounded-2xl bg-white">
                <div className="flex items-center gap-4">
                    <Avatar name={person.name} degree={person.degree} size="lg"/>
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold">{person.name}</div>
                            <DegreeBadge degree={person.degree}/>
                        </div>
                        <div className="text-sm text-gray-500">
                            {person.status === "self" ? "This is you"
                                : person.degree === null ? "Not in your network yet"
                                : `${["", "1st", "2nd", "3rd"][person.degree]} degree connection`}
                        </div>
                    </div>
                </div>
                {person.status !== "self" && <ConnectionActions person={person} onChange={load}/>}
            </div>

            {person.status !== "self" &&
                <PeopleCard title={`Mutual connections (${mutual.length})`} hint={`People you both know`}>
                    {mutual.length === 0 && <div className="px-4 py-3 text-gray-500 text-sm">No mutual connections.</div>}
                    {mutual.map((u) => <PersonRow key={u.id} person={u} onChange={load}/>)}
                </PeopleCard>}

            <PeopleCard title={`${whose} connections${connections ? ` (${connections.length})` : ""}`}>
                {connections === null
                    ? <div className="px-4 py-3 text-gray-500 text-sm">Connect with {person.name} to see all of their connections.</div>
                    : connections.length === 0
                        ? <div className="px-4 py-3 text-gray-500 text-sm">No connections yet.</div>
                        : connections.map((u) => <PersonRow key={u.id} person={u} onChange={load}/>)}
            </PeopleCard>
        </div>
    );
}
