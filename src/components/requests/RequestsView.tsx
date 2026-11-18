"use client";

import Link from "next/link";
import {ArrowRight, Inbox, Shield} from "lucide-react";
import {useNetwork} from "@/components/network/NetworkProvider";
import {plural} from "@/components/people/helpers";
import {AvatarRing, DegreeDot} from "@/components/UI/Avatar";
import ConnectionActions from "@/components/people/ConnectionActions";
import {EmptyState, ErrorState, PageLoading} from "@/components/UI/States";

export default function RequestsView() {
    const {people, counts, meta, loading, error, refresh} = useNetwork();

    if (loading && !people) return <PageLoading/>;
    if (error && !people) return <ErrorState message={error} onRetry={() => void refresh()}/>;
    if (!people) return <PageLoading/>;

    const received = people.filter((p) => p.status === "received");
    const sent = people.filter((p) => p.status === "sent");

    return (
        <div>
            <div className="gn-page-head">
                <div className="gn-page-head-txt">
                    <h1 className="gn-h1">Requests</h1>
                    <p className="gn-meta" style={{marginTop: 8}}>
                        <span><b>{counts.received}</b> incoming</span>
                        <i className="sep" aria-hidden="true"/>
                        <span><b>{counts.sent}</b> outgoing</span>
                        <i className="sep" aria-hidden="true"/>
                        <span><b>{counts.first}</b> established</span>
                        <i className="sep" aria-hidden="true"/>
                        <span><b>{meta.queryMs ?? "—"}</b> ms Cypher</span>
                    </p>
                </div>
            </div>

            <div className="gn-2col gn-2col-requests">
                <section className="gn-card">
                    <div className="gn-card-h">
                        <span className="gn-card-title">Received</span>
                        <span className="gn-card-meta">{received.length} waiting</span>
                    </div>
                    {received.length > 0 ? received.map((p) => (
                        <div className="gn-row gn-request-row" key={p.id}>
                            <AvatarRing
                                name={p.name}
                                degree={p.degree}
                                status={p.status}
                                size="lg"
                            />
                            <div className="gn-row-txt">
                                <div className="gn-row-name">
                                    <Link href={`/connections?user_id=${encodeURIComponent(p.id)}`}>
                                        {p.name}
                                    </Link>
                                    <DegreeDot status={p.status} degree={p.degree}/>
                                </div>
                                <div className="gn-row-sub">
                                    {p.mutual > 0
                                        ? `${plural(p.mutual, "mutual connection")} with you`
                                        : "No mutual connections"}
                                </div>
                                <div className="gn-request-note">REQUESTED → you</div>
                            </div>
                            <div className="gn-row-act">
                                <ConnectionActions person={p} size="xs"/>
                            </div>
                        </div>
                    )) : (
                        <EmptyState
                            icon={<Inbox size={20}/>}
                            title="No invitations to review"
                            description="When someone asks to connect, their request lands here."
                        />
                    )}
                </section>

                <div className="gn-stack">
                    <section className="gn-card">
                        <div className="gn-card-h">
                            <span className="gn-card-title">Sent</span>
                            <span className="gn-card-meta">{sent.length} awaiting</span>
                        </div>
                        {sent.length > 0 ? sent.map((p) => (
                            <div className="gn-row" key={p.id}>
                                <AvatarRing
                                    name={p.name}
                                    degree={p.degree}
                                    status={p.status}
                                    size="sm"
                                />
                                <div className="gn-row-txt">
                                    <div className="gn-row-name">
                                        <Link href={`/connections?user_id=${encodeURIComponent(p.id)}`}>
                                            {p.name}
                                        </Link>
                                    </div>
                                    <div className="gn-row-sub">No answer yet</div>
                                </div>
                                <div className="gn-row-act">
                                    <ConnectionActions person={p} size="xs"/>
                                </div>
                            </div>
                        )) : (
                            <EmptyState
                                compact
                                title="No outgoing requests"
                                description="Requests you send wait here until the other person answers."
                            />
                        )}
                    </section>

                    <section className="gn-card">
                        <div className="gn-card-h">
                            <span className="gn-card-title">How a request moves</span>
                        </div>
                        <div className="gn-card-b" style={{padding: "14px 16px"}}>
                            <div className="gn-flow-steps">
                                <span className="gn-deg gn-deg-0">Sent</span>
                                <ArrowRight size={12} className="gn-dim"/>
                                <span className="gn-deg gn-deg-self">Accepted</span>
                                <ArrowRight size={12} className="gn-dim"/>
                                <span className="gn-deg is-ok">Connected</span>
                            </div>
                            <p className="gn-help-note">
                                Accepting adds a <span className="gn-mono">CONNECTED</span> edge in the graph.
                                Ignoring or withdrawing drops the <span className="gn-mono">REQUESTED</span> edge
                                and nothing else changes.
                            </p>
                            <div className="gn-divider" style={{margin: "12px 0"}}/>
                            <div className="gn-flex gn-ic gn-gap-8">
                                <span className="gn-ic gn-dim"><Shield size={14}/></span>
                                <span className="gn-tiny gn-dim">Only you and the other person can see a pending request.</span>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
