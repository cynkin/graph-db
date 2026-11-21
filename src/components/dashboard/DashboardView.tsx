"use client";

import {useEffect, useState} from "react";
import {Compass, Inbox} from "lucide-react";
import {useNetwork} from "@/components/network/NetworkProvider";
import {firstName, suggestedPeople} from "@/components/people/helpers";
import OrbitMap from "@/components/dashboard/OrbitMap";
import PersonRow from "@/components/people/PersonRow";
import {EmptyState, ErrorState, PageLoading} from "@/components/UI/States";

const RING_CAP = 30;

export default function DashboardView() {
    const {me, people, counts, meta, loading, error, refresh} = useNetwork();
    const [greeting, setGreeting] = useState("Welcome back");

    useEffect(() => {
        const hour = new Date().getHours();
        setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
    }, []);

    if (loading && !people) return <PageLoading/>;
    if (error && !people) {
        return <ErrorState message={error} onRetry={() => void refresh()}/>;
    }
    if (!people) return <PageLoading/>;

    const meName = me?.name ?? "You";
    const received = people.filter((p) => p.status === "received");
    const suggestions = suggestedPeople(people, 3);
    const hello = me?.name ? `${greeting}, ${firstName(me.name)}` : greeting;
    const capped =
        counts.first > RING_CAP || counts.second > RING_CAP || counts.third > RING_CAP;

    const stats = [
        {value: counts.first, label: "1st degree", tone: "k1"},
        {value: counts.second, label: "2nd degree", tone: "k2"},
        {value: counts.third, label: "3rd degree", tone: "k3"},
        {value: counts.received, label: "Requests waiting", tone: "k0"},
    ];

    return (
        <div>
            <div className="gn-page-head">
                <div className="gn-page-head-txt">
                    <div className="gn-eyebrow">Network overview</div>
                    <h1 className="gn-h1" style={{marginTop: 7}}>{hello}</h1>
                    <p className="gn-meta" style={{marginTop: 8}}>
                        <span>
                            <b>{counts.inside + 1}</b> {counts.inside + 1 === 1 ? "node" : "nodes"} within 3 steps
                        </span>
                        <i className="sep" aria-hidden="true"/>
                        <span>
                            <b>{counts.first + counts.sent + counts.received}</b>{" "}
                            {counts.first + counts.sent + counts.received === 1 ? "direct edge" : "direct edges"}
                        </span>
                        <i className="sep" aria-hidden="true"/>
                        <span><b>{meta.queryMs ?? "—"}</b> ms Cypher</span>
                    </p>
                </div>
            </div>

            <div className="gn-stats">
                {stats.map((s) => (
                    <div className="gn-stat" key={s.label}>
                        <div className="gn-stat-v">{s.value}</div>
                        <div className="gn-stat-l">
                            <span className={`gn-stat-k ${s.tone}`}/>{s.label}
                        </div>
                    </div>
                ))}
            </div>

            <div className="gn-2col" style={{marginTop: 14}}>
                <section className="gn-card">
                    <div className="gn-card-h">
                        <span className="gn-card-title">Network map</span>
                        <span className="gn-card-meta">
                            {counts.inside} of {counts.total} inside 3 steps
                        </span>
                    </div>
                    <div className="gn-card-b flush">
                        <div className="gn-map-body">
                            <div className="gn-map-legend">
                                {[
                                    {k: "k1", label: "1st degree", hint: "direct", value: counts.first},
                                    {k: "k2", label: "2nd degree", hint: "one step out", value: counts.second},
                                    {k: "k3", label: "3rd degree", hint: "two steps out", value: counts.third},
                                ].map((row) => (
                                    <div className="lg-row" key={row.label}>
                                        <span className="gn-orbit-key"><i className={row.k}/></span>
                                        <span>
                                            <span className="lg-label" style={{display: "block"}}>{row.label}</span>
                                            <span className="lg-hint" style={{display: "block"}}>{row.hint}</span>
                                        </span>
                                        <span className="lg-v">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="gn-grow" style={{height: "100%"}}>
                                <OrbitMap people={people} meName={meName}/>
                            </div>
                        </div>
                        {capped && (
                            <div className="gn-map-caption">
                                Showing up to {RING_CAP} people per ring so the map stays legible. Counts are exact.
                            </div>
                        )}
                    </div>
                </section>

                <div className="gn-stack">
                    <section className="gn-card">
                        <div className="gn-card-h">
                            <span className="gn-card-title">Requests</span>
                            <span className="gn-card-meta">{counts.received} waiting</span>
                        </div>
                        {received.length > 0 ? (
                            received.slice(0, 3).map((p) => <PersonRow key={p.id} person={p}/>)
                        ) : (
                            <EmptyState
                                compact
                                icon={<Inbox size={20}/>}
                                title="No requests waiting"
                                description="New invitations will appear here. Discover people to send the first one."
                            />
                        )}
                        <div className="gn-card-f">
                            <span className="gn-tiny gn-dim">
                                <span className="gn-num" style={{color: "var(--text-secondary)"}}>{counts.sent}</span>{" "}
                                sent · awaiting response
                            </span>
                        </div>
                    </section>
                </div>
            </div>

            <div className="gn-section-head">
                <h2 className="gn-h2">People you may know</h2>
                <span className="gn-hint-inline">Ranked by mutual connections</span>
            </div>
            {suggestions.length > 0 ? (
                <div className="gn-card gn-list-card">
                    {suggestions.map((p) => <PersonRow key={p.id} person={p}/>)}
                </div>
            ) : (
                <div className="gn-card">
                    <EmptyState
                        icon={<Compass size={20}/>}
                        title="No suggestions right now"
                        description="When people two or three steps away share a connection with you, they will appear here."
                    />
                </div>
            )}
        </div>
    );
}
