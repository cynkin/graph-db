"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {useSession} from "next-auth/react";
import {usePathname} from "next/navigation";
import type {ActionResult, ConnectionAction, Person} from "@/components/people/types";
import {byDegree, type DegreeBuckets} from "@/components/people/helpers";

type Me = {id: string; name: string; email: string};

type Counts = {
    total: number;
    first: number;
    second: number;
    third: number;
    inside: number;
    received: number;
    sent: number;
};

type NetworkApi = {
    me: Me | null;
    people: Person[] | null;
    buckets: DegreeBuckets;
    counts: Counts;
    meta: {queryMs: number | null};
    loading: boolean;
    error: string;
    refresh: () => Promise<void>;
    act: (person: Person, action: ConnectionAction) => Promise<ActionResult>;
    isBusy: (id: string) => boolean;
};

const NetworkContext = createContext<NetworkApi | null>(null);

function applyLocal(p: Person, action: ConnectionAction): Person {
    switch (action) {
        case "request":
            // The backend auto-accepts when the other person has already requested you.
            return {...p, status: p.status === "received" ? "connected" : "sent"};
        case "accept":
            return {...p, status: "connected"};
        case "ignore":
        case "remove":
            return {...p, status: "none"};
    }
}

const EMPTY_BUCKETS: DegreeBuckets = {all: [], first: [], second: [], third: []};

export function NetworkProvider({children}: {children: React.ReactNode}) {
    const {data: session} = useSession();
    const pathname = usePathname();
    const [people, setPeople] = useState<Person[] | null>(null);
    const [meta, setMeta] = useState<{queryMs: number | null}>({queryMs: null});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState<string[]>([]);

    const sequence = useRef(0);
    const inFlight = useRef(new Map<string, Promise<ActionResult>>());

    const load = useCallback(async (background = false) => {
        const seq = ++sequence.current;
        if (!background) setLoading(true);
        try {
            const res = await fetch("/api/network", {cache: "no-store"});
            if (!res.ok) {
                throw new Error(
                    res.status === 401
                        ? "Your session expired. Sign in again to continue."
                        : "Could not load your network. Check that the graph database is reachable."
                );
            }
            const data = await res.json() as {users: Person[]; meta?: {queryMs: number}};
            if (seq !== sequence.current) return;
            setPeople(data.users);
            setMeta({queryMs: data.meta?.queryMs ?? null});
            setError("");
        } catch (e) {
            if (seq !== sequence.current) return;
            setError(e instanceof Error ? e.message : "Could not load your network.");
        } finally {
            if (seq === sequence.current) setLoading(false);
        }
    }, []);

    // Every navigation re-reads the graph, so a tab never shows data from a previous visit.
    // The first paint shows the loading state; later visits refresh in the background.
    const firstPath = useRef(true);
    useEffect(() => {
        const isFirst = firstPath.current;
        firstPath.current = false;
        void load(!isFirst);
    }, [pathname, load]);

    const refresh = useCallback(async () => {
        await load(true);
    }, [load]);

    const act = useCallback(async (person: Person, action: ConnectionAction): Promise<ActionResult> => {
        const existing = inFlight.current.get(person.id);
        if (existing) return existing;

        const task = (async (): Promise<ActionResult> => {
            setBusy((current) => [...current, person.id]);
            try {
                const res = await fetch("/api/connections", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({action, user_id: person.id}),
                });
                const payload = await res.json().catch(() => ({} as {error?: string}));

                if (!res.ok) {
                    return {
                        ok: false,
                        error: res.status === 401
                            ? "Your session expired. Sign in again to continue."
                            : payload.error ?? "The connection could not be updated.",
                    };
                }

                // Reflect the change immediately, then reconcile with the graph.
                setPeople((current) =>
                    current?.map((p) => (p.id === person.id ? applyLocal(p, action) : p)) ?? current
                );
                await load(true);
                return {ok: true};
            } catch {
                return {ok: false, error: "Network error. Check your connection and try again."};
            } finally {
                inFlight.current.delete(person.id);
                setBusy((current) => current.filter((id) => id !== person.id));
            }
        })();

        inFlight.current.set(person.id, task);
        return task;
    }, [load]);

    const buckets = useMemo(() => (people ? byDegree(people) : EMPTY_BUCKETS), [people]);

    const counts = useMemo<Counts>(() => ({
        total: people?.length ?? 0,
        first: buckets.first.length,
        second: buckets.second.length,
        third: buckets.third.length,
        inside: buckets.first.length + buckets.second.length + buckets.third.length,
        received: people?.filter((p) => p.status === "received").length ?? 0,
        sent: people?.filter((p) => p.status === "sent").length ?? 0,
    }), [people, buckets]);

    const me = useMemo<Me | null>(() => {
        if (!session?.user?.id) return null;
        return {
            id: session.user.id,
            name: session.user.name ?? "You",
            email: session.user.email,
        };
    }, [session]);

    const value = useMemo<NetworkApi>(() => ({
        me,
        people,
        buckets,
        counts,
        meta,
        loading,
        error,
        refresh,
        act,
        isBusy: (id: string) => busy.includes(id),
    }), [me, people, buckets, counts, meta, loading, error, refresh, act, busy]);

    return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkApi {
    const ctx = useContext(NetworkContext);
    if (!ctx) throw new Error("useNetwork must be used inside NetworkProvider");
    return ctx;
}
