"use client";

import {useDeferredValue, useEffect, useMemo, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {Clock, GitBranch, Search, Users} from "lucide-react";
import {useNetwork} from "@/components/network/NetworkProvider";
import type {Person} from "@/components/people/types";
import type {PeopleSort} from "@/components/people/helpers";
import {displayDegree, sortPeople} from "@/components/people/helpers";
import PersonCard from "@/components/people/PersonCard";
import {EmptyState, ErrorState, PageLoading} from "@/components/UI/States";

type Tab = "all" | "first" | "second" | "third";

const TABS: {key: Tab; label: string; tone?: string}[] = [
    {key: "all", label: "All"},
    {key: "first", label: "1st", tone: "k1"},
    {key: "second", label: "2nd", tone: "k2"},
    {key: "third", label: "3rd", tone: "k3"},
];

const TITLES: Record<Tab, string> = {
    all: "All people",
    first: "Your 1st degree connections",
    second: "Two steps away",
    third: "Three steps away",
};

function normalizeTab(value: string | null): Tab {
    if (value === "1" || value === "first") return "first";
    if (value === "2" || value === "second") return "second";
    if (value === "3" || value === "third") return "third";
    return "all";
}

function targetDegree(tab: Tab): number | undefined {
    if (tab === "first") return 1;
    if (tab === "second") return 2;
    if (tab === "third") return 3;
    return undefined;
}

export default function NetworkView() {
    const router = useRouter();
    const params = useSearchParams();
    const degreeParam = params.get("degree");
    const {people, buckets, meta, loading, error, refresh} = useNetwork();

    const [tab, setTab] = useState<Tab>(() => normalizeTab(degreeParam));
    const [q, setQ] = useState("");
    const deferredQ = useDeferredValue(q.trim().toLowerCase());
    const [onlyMutual, setOnlyMutual] = useState(false);
    const [pendingOnly, setPendingOnly] = useState(false);
    const [sort, setSort] = useState<PeopleSort>("distance");

    useEffect(() => {
        setTab(normalizeTab(degreeParam));
    }, [degreeParam]);

    const list = useMemo(() => {
        let out: Person[] = people ?? [];
        const target = targetDegree(tab);
        if (target !== undefined) out = out.filter((p) => displayDegree(p) === target);
        if (deferredQ) out = out.filter((p) => p.name.toLowerCase().includes(deferredQ));
        if (onlyMutual) out = out.filter((p) => p.mutual > 0);
        if (pendingOnly) out = out.filter((p) => p.status === "sent" || p.status === "received");
        return sortPeople(out, sort);
    }, [people, tab, deferredQ, onlyMutual, pendingOnly, sort]);

    if (loading && !people) return <PageLoading/>;
    if (error && !people) return <ErrorState message={error} onRetry={() => void refresh()}/>;
    if (!people) return <PageLoading/>;

    const counts: Record<Tab, number> = {
        all: people.length,
        first: buckets.first.length,
        second: buckets.second.length,
        third: buckets.third.length,
    };

    const changeTab = (next: Tab) => {
        setTab(next);
        const degree = next === "first" ? "1" : next === "second" ? "2" : "3";
        router.replace(next === "all" ? "/network" : `/network?degree=${degree}`, {scroll: false});
    };

    const clearFilters = () => {
        setQ("");
        setOnlyMutual(false);
        setPendingOnly(false);
    };

    const filtersActive = q.trim().length > 0 || onlyMutual || pendingOnly;
    const emptyTitle = deferredQ ? `No one matches “${q.trim()}”` : "Nobody in this band yet";
    const emptyDescription = deferredQ
        ? "Search matches names only. Try a first name, or clear the filters."
        : "Connect with more people and this view fills up.";

    return (
        <div>
            <div className="gn-page-head">
                <div className="gn-page-head-txt">
                    <h1 className="gn-h1">My network</h1>
                    <p className="gn-meta" style={{marginTop: 8}}>
                        <span><b>{people.length}</b> {people.length === 1 ? "node" : "nodes"}</span>
                        <i className="sep" aria-hidden="true"/>
                        <span><b>{buckets.first.length}</b> direct</span>
                        <i className="sep" aria-hidden="true"/>
                        <span><b>{buckets.second.length + buckets.third.length}</b> indirect</span>
                        <i className="sep" aria-hidden="true"/>
                        <span><b>{meta.queryMs ?? "—"}</b> ms Cypher</span>
                    </p>
                </div>
                <div className="gn-page-head-actions">
                    <select
                        className="gn-select"
                        value={sort}
                        onChange={(e) => setSort(e.target.value as PeopleSort)}
                        aria-label="Sort people"
                    >
                        <option value="distance">Distance, then mutuals</option>
                        <option value="mutual">Most mutual connections</option>
                        <option value="name">Name A to Z</option>
                    </select>
                </div>
            </div>

            <div className="gn-tabs-scroll">
                <div className="gn-tabs gn-tabs-lg" role="tablist" aria-label="Connection degree">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            role="tab"
                            aria-selected={tab === t.key}
                            className={`gn-tab${tab === t.key ? " is-active" : ""}`}
                            onClick={() => changeTab(t.key)}
                        >
                            {t.tone && <span className={`gn-stat-k ${t.tone}`} aria-hidden="true"/>}
                            {t.label}
                            <span className="gn-tab-n">{counts[t.key]}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="gn-filterbar">
                <div className="gn-search is-sm">
                    <span className="gn-search-ico"><Search size={14}/></span>
                    <input
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Filter by name"
                        aria-label="Filter your network by name"
                    />
                </div>
                <div className="gn-chips">
                    <button
                        type="button"
                        className={`gn-chip${onlyMutual ? " is-on" : ""}`}
                        onClick={() => setOnlyMutual((v) => !v)}
                        aria-pressed={onlyMutual}
                    >
                        <GitBranch size={12}/>Has mutual connections
                    </button>
                    <button
                        type="button"
                        className={`gn-chip${pendingOnly ? " is-on" : ""}`}
                        onClick={() => setPendingOnly((v) => !v)}
                        aria-pressed={pendingOnly}
                    >
                        <Clock size={12}/>Pending
                    </button>
                </div>
                {filtersActive && (
                    <button type="button" className="gn-clear-filters" onClick={clearFilters}>
                        Clear filters
                    </button>
                )}
                <span className="gn-result-meta">
                    {TITLES[tab]} · showing {list.length}
                </span>
            </div>

            {list.length === 0 ? (
                <div className="gn-card">
                    <EmptyState
                        icon={<Users size={20}/>}
                        title={emptyTitle}
                        description={emptyDescription}
                        action={
                            filtersActive
                                ? <button type="button" className="gn-btn gn-btn-secondary gn-btn-sm" onClick={clearFilters}>Clear filters</button>
                                : undefined
                        }
                    />
                </div>
            ) : (
                <div className="gn-people">
                    {list.map((p) => <PersonCard key={p.id} person={p}/>)}
                </div>
            )}
        </div>
    );
}
