"use client";

import {useDeferredValue, useEffect, useMemo, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {Compass, GitBranch, Search, Clock} from "lucide-react";
import {useNetwork} from "@/components/network/NetworkProvider";
import type {Person} from "@/components/people/types";
import {displayDegree} from "@/components/people/helpers";
import PersonRow from "@/components/people/PersonRow";
import {EmptyState, ErrorState, PageLoading} from "@/components/UI/States";

type DegreeFilter = "" | "1" | "2" | "3";

const RANK: Record<Person["status"], number> = {
    none: 0,
    received: 0,
    sent: 1,
    connected: 2,
    self: 3,
};

function normalizeDegree(value: string | null): DegreeFilter {
    return value === "1" || value === "2" || value === "3" ? value : "";
}

export default function DiscoverView() {
    const router = useRouter();
    const params = useSearchParams();
    const qParam = params.get("q") ?? "";
    const degreeParam = normalizeDegree(params.get("degree"));
    const mutualParam = params.get("mutual") === "1";
    const pendingParam = params.get("pending") === "1";

    const {people, meta, loading, error, refresh} = useNetwork();
    const [q, setQ] = useState(qParam);
    const [degree, setDegree] = useState<DegreeFilter>(degreeParam);
    const [onlyMutual, setOnlyMutual] = useState(mutualParam);
    const [pendingOnly, setPendingOnly] = useState(pendingParam);
    const deferredQ = useDeferredValue(q.trim().toLowerCase());

    useEffect(() => {
        setQ(qParam);
        setDegree(degreeParam);
        setOnlyMutual(mutualParam);
        setPendingOnly(pendingParam);
    }, [qParam, degreeParam, mutualParam, pendingParam]);

    const list = useMemo(() => {
        let out: Person[] = people ?? [];
        if (deferredQ) out = out.filter((p) => p.name.toLowerCase().includes(deferredQ));
        if (degree) {
            const target = Number(degree);
            out = out.filter((p) => displayDegree(p) === target);
        }
        if (onlyMutual) out = out.filter((p) => p.mutual > 0);
        if (pendingOnly) out = out.filter((p) => p.status === "sent" || p.status === "received");

        return out.sort((a, b) =>
            RANK[a.status] - RANK[b.status]
            || b.mutual - a.mutual
            || (displayDegree(a) ?? 9) - (displayDegree(b) ?? 9)
            || a.name.localeCompare(b.name)
        );
    }, [people, deferredQ, degree, onlyMutual, pendingOnly]);

    const buildUrl = (next: {
        q?: string;
        degree?: DegreeFilter;
        mutual?: boolean;
        pending?: boolean;
    }): string => {
        const sp = new URLSearchParams();
        const value = (next.q ?? q).trim();
        if (value) sp.set("q", value);
        const deg = next.degree ?? degree;
        if (deg) sp.set("degree", deg);
        if (next.mutual ?? onlyMutual) sp.set("mutual", "1");
        if (next.pending ?? pendingOnly) sp.set("pending", "1");
        const query = sp.toString();
        return query ? `/discover?${query}` : "/discover";
    };

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        router.push(buildUrl({q}), {scroll: false});
    };

    const toggleMutual = () => {
        const next = !onlyMutual;
        setOnlyMutual(next);
        router.replace(buildUrl({mutual: next}), {scroll: false});
    };

    const togglePending = () => {
        const next = !pendingOnly;
        setPendingOnly(next);
        router.replace(buildUrl({pending: next}), {scroll: false});
    };

    const changeDegree = (next: DegreeFilter) => {
        setDegree(next);
        router.replace(buildUrl({degree: next}), {scroll: false});
    };

    const clear = () => {
        setQ("");
        setDegree("");
        setOnlyMutual(false);
        setPendingOnly(false);
        router.push("/discover", {scroll: false});
    };

    if (loading && !people) return <PageLoading/>;
    if (error && !people) return <ErrorState message={error} onRetry={() => void refresh()}/>;
    if (!people) return <PageLoading/>;

    const filtersActive = q.trim().length > 0 || degree !== "" || onlyMutual || pendingOnly;

    return (
        <div>
            <div className="gn-page-head">
                <div className="gn-page-head-txt">
                    <h1 className="gn-h1">Discover people</h1>
                    <p className="gn-meta" style={{marginTop: 8}}>
                        <span><b>{people.length}</b> {people.length === 1 ? "node" : "nodes"}</span>
                        <i className="sep" aria-hidden="true"/>
                        <span><b>3</b> degrees</span>
                        <i className="sep" aria-hidden="true"/>
                        <span>distance + mutuals via Cypher</span>
                        <i className="sep" aria-hidden="true"/>
                        <span><b>{meta.queryMs ?? "—"}</b> ms</span>
                    </p>
                </div>
            </div>

            <div className="gn-card gn-search-card">
                <form className="gn-flex gn-ic gn-gap-8 gn-flex-wrap" onSubmit={submit}>
                    <div className="gn-search gn-search-lg gn-grow">
                        <span className="gn-search-ico"><Search size={17}/></span>
                        <input
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search by first or last name"
                            aria-label="Search people by name"
                            autoComplete="off"
                        />
                    </div>
                    <button type="submit" className="gn-btn gn-btn-primary gn-btn-sm">Search</button>
                </form>

                <div className="gn-discover-filters">
                    <div className="gn-chips">
                        <button
                            type="button"
                            className={`gn-chip${onlyMutual ? " is-on" : ""}`}
                            onClick={toggleMutual}
                            aria-pressed={onlyMutual}
                        >
                            <GitBranch size={12}/>Has mutual connections
                        </button>
                        <button
                            type="button"
                            className={`gn-chip${pendingOnly ? " is-on" : ""}`}
                            onClick={togglePending}
                            aria-pressed={pendingOnly}
                        >
                            <Clock size={12}/>Pending only
                        </button>
                    </div>
                    <div className="gn-select-wrap">
                        <span className="gn-tiny gn-dim">Degree</span>
                        <select
                            className="gn-select"
                            value={degree}
                            onChange={(e) => changeDegree(e.target.value as DegreeFilter)}
                            aria-label="Filter by degree"
                        >
                            <option value="">Any distance</option>
                            <option value="1">1st degree</option>
                            <option value="2">2nd degree</option>
                            <option value="3">3rd degree</option>
                        </select>
                    </div>
                </div>
            </div>

            <section className="gn-card gn-results-card">
                <div className="gn-card-h">
                    <span className="gn-card-title">Results</span>
                    <span className="gn-card-meta">{list.length} {list.length === 1 ? "person" : "people"}</span>
                    {filtersActive && (
                        <span className="gn-card-act">
                            <button type="button" className="gn-btn gn-btn-ghost gn-btn-xs" onClick={clear}>
                                Clear filters
                            </button>
                        </span>
                    )}
                </div>

                {list.length === 0 ? (
                    <EmptyState
                        icon={<Compass size={20}/>}
                        title={q.trim() ? `No one matches “${q.trim()}”` : "No one matches these filters"}
                        description="Search matches names only. Try a first name, widen the degree, or clear the filters."
                        action={
                            filtersActive
                                ? <button type="button" className="gn-btn gn-btn-secondary gn-btn-sm" onClick={clear}>Clear filters</button>
                                : undefined
                        }
                    />
                ) : (
                    list.map((p) => <PersonRow key={p.id} person={p}/>)
                )}
            </section>
        </div>
    );
}
