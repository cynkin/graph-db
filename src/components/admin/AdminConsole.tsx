"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {signOut} from "next-auth/react";
import {
    AlertTriangle,
    Database,
    GitBranch,
    LogOut,
    Maximize2,
    RefreshCw,
    Search,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import type {AdminUser, NodeStats, WholeGraph} from "@/components/people/types";
import BrandMark from "@/components/UI/BrandMark";
import GraphCanvas, {type GraphHandle} from "@/components/admin/GraphCanvas";
import GraphDetailPanel from "@/components/admin/GraphDetailPanel";
import UsersTable from "@/components/admin/UsersTable";
import {EmptyState, ErrorState} from "@/components/UI/States";

type AdminData = {graph: WholeGraph; users: AdminUser[]};

export default function AdminConsole() {
    const [data, setData] = useState<AdminData | null>(null);
    const [error, setError] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hidden, setHidden] = useState({CONNECTED: false, REQUESTED: false});
    const [nodeQuery, setNodeQuery] = useState("");
    const [pane, setPane] = useState<"graph" | "users">("graph");

    const graphRef = useRef<GraphHandle>(null);
    const sequence = useRef(0);

    const load = useCallback(async () => {
        const seq = ++sequence.current;
        setRefreshing(true);
        try {
            const res = await fetch("/api/admin", {cache: "no-store"});
            if (!res.ok) {
                throw new Error(
                    res.status === 403
                        ? "Admins only. Sign in with an administrator account."
                        : "Could not load the admin data. Check that Neo4j and SQLite are reachable."
                );
            }
            const payload = await res.json() as AdminData;
            if (seq !== sequence.current) return;
            setData(payload);
            setError("");
        } catch (e) {
            if (seq !== sequence.current) return;
            setError(e instanceof Error ? e.message : "Could not load the admin data.");
        } finally {
            if (seq === sequence.current) setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const nodes = useMemo(() => data?.graph.nodes ?? [], [data]);
    const links = useMemo(() => data?.graph.links ?? [], [data]);

    const nodeStats = useMemo(() => {
        const map: Record<string, NodeStats> = {};
        for (const node of nodes) map[node.id] = {connections: 0, incoming: 0, outgoing: 0};
        for (const link of links) {
            const source = map[link.source];
            const target = map[link.target];
            if (link.type === "CONNECTED") {
                if (source) source.connections += 1;
                if (target) target.connections += 1;
            } else {
                if (source) source.outgoing += 1;
                if (target) target.incoming += 1;
            }
        }
        return map;
    }, [nodes, links]);

    const connected = useMemo(() => links.filter((l) => l.type === "CONNECTED").length, [links]);
    const requested = links.length - connected;

    useEffect(() => {
        if (!data || !selectedId) return;
        if (!data.graph.nodes.some((n) => n.id === selectedId)) setSelectedId(null);
    }, [data, selectedId]);

    const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null;
    const selectedStats = selectedId ? nodeStats[selectedId] ?? null : null;

    // The rail switches the main area between the graph and the users table.
    const jumpTo = (next: "graph" | "users") => setPane(next);

    const searchNode = () => {
        const q = nodeQuery.trim().toLowerCase();
        if (!q) return;
        const hit = nodes.find((n) => n.name.toLowerCase().includes(q));
        if (hit) {
            setSelectedId(hit.id);
            graphRef.current?.focusNode(hit.id);
        }
    };

    const toggleRelation = (type: "CONNECTED" | "REQUESTED") => {
        setHidden((current) => ({...current, [type]: !current[type]}));
    };

    // Sign out, then hard-navigate to a relative URL so the redirect stays on whatever host serves the app.
    const handleSignOut = async () => {
        await signOut({redirect: false});
        window.location.assign("/auth/login");
    };

    return (
        <div className="gn gn-admin" data-mode="app">
            <aside className="gn-rail" aria-label="Admin navigation">
                <Link href="/admin" aria-label="GraphNet admin console">
                    <BrandMark size={26} className="gn-rail-mark"/>
                </Link>
                <button
                    type="button"
                    className={`gn-rail-btn${pane === "graph" ? " is-active" : ""}`}
                    onClick={() => jumpTo("graph")}
                    aria-label="Graph view"
                    aria-pressed={pane === "graph"}
                >
                    <GitBranch size={18}/>
                </button>
                <button
                    type="button"
                    className={`gn-rail-btn${pane === "users" ? " is-active" : ""}`}
                    onClick={() => jumpTo("users")}
                    aria-label="Users table"
                    aria-pressed={pane === "users"}
                >
                    <Database size={18}/>
                </button>
                <div className="gn-rail-sep"/>
                <button
                    type="button"
                    className="gn-rail-btn"
                    onClick={() => void load()}
                    aria-label="Refresh data"
                    disabled={refreshing}
                >
                    <RefreshCw size={17} className={refreshing ? "gn-spin" : undefined}/>
                </button>
                <div className="gn-rail-spacer"/>
                <button
                    type="button"
                    className="gn-rail-btn"
                    onClick={() => void handleSignOut()}
                    aria-label="Sign out"
                >
                    <LogOut size={17}/>
                </button>
            </aside>

            <div className="gn-admin-main" data-pane={pane}>
                <div className="gn-admin-bar">
                    <span className="gn-admin-title">{pane === "graph" ? "Network graph" : "SQLite users"}</span>
                    <div className="gn-admin-counts">
                        {pane === "graph" ? (
                            <>
                                <span className="gn-admin-count"><b>{data ? nodes.length : "—"}</b>nodes</span>
                                <span className="gn-admin-count"><b>{data ? connected : "—"}</b>connected</span>
                                <span className="gn-admin-count"><b>{data ? requested : "—"}</b>requested</span>
                            </>
                        ) : (
                            <span className="gn-admin-count">
                                <b>{data ? data.users.length : "—"}</b>rows · admin excluded
                            </span>
                        )}
                    </div>
                    <div className="gn-graph-toolbar">
                        {pane === "graph" && (
                            <>
                                <div className="gn-search is-sm" style={{height: 28, width: 200}}>
                                    <span className="gn-search-ico"><Search size={13}/></span>
                                    <input
                                        type="search"
                                        value={nodeQuery}
                                        onChange={(e) => setNodeQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                searchNode();
                                            }
                                        }}
                                        placeholder="Find a node"
                                        aria-label="Find a node"
                                        style={{fontSize: 12}}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className={`gn-toggle${hidden.CONNECTED ? "" : " is-on"}`}
                                    onClick={() => toggleRelation("CONNECTED")}
                                    aria-pressed={!hidden.CONNECTED}
                                >
                                    <i/>CONNECTED
                                </button>
                                <button
                                    type="button"
                                    className={`gn-toggle${hidden.REQUESTED ? "" : " is-on"}`}
                                    onClick={() => toggleRelation("REQUESTED")}
                                    aria-pressed={!hidden.REQUESTED}
                                >
                                    <i className="req"/>REQUESTED
                                </button>
                                <span className="gn-top-sep"/>
                                <button
                                    type="button"
                                    className="gn-iconbtn"
                                    onClick={() => graphRef.current?.zoomIn()}
                                    aria-label="Zoom in"
                                >
                                    <ZoomIn size={16}/>
                                </button>
                                <button
                                    type="button"
                                    className="gn-iconbtn"
                                    onClick={() => graphRef.current?.zoomOut()}
                                    aria-label="Zoom out"
                                >
                                    <ZoomOut size={16}/>
                                </button>
                                <button
                                    type="button"
                                    className="gn-iconbtn"
                                    onClick={() => graphRef.current?.fit()}
                                    aria-label="Fit graph"
                                >
                                    <Maximize2 size={16}/>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {error && data && (
                    <div className="gn-admin-alert" role="alert">
                        <AlertTriangle size={14}/>
                        <span>{error}</span>
                        <button type="button" className="gn-btn gn-btn-quiet gn-btn-xs" onClick={() => void load()}>
                            Retry
                        </button>
                    </div>
                )}

                {!data && error ? (
                    <div className="gn-admin-state">
                        <ErrorState
                            title="Could not load admin data"
                            message={error}
                            onRetry={() => void load()}
                        />
                    </div>
                ) : !data ? (
                    <div className="gn-admin-state">
                        <div className="gn-skeleton-page" style={{width: "min(620px, 92%)"}} role="status" aria-live="polite">
                            <span className="gn-sr">Loading the graph and users table…</span>
                            <div className="gn-skel" style={{height: 24, width: "38%"}}/>
                            <div className="gn-skel" style={{height: 300, borderRadius: 12}}/>
                            <div className="gn-skel" style={{height: 120, borderRadius: 12}}/>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="gn-graph-area">
                            <GraphCanvas
                                ref={graphRef}
                                nodes={nodes}
                                links={links}
                                stats={nodeStats}
                                hidden={hidden}
                                selectedId={selectedId}
                                onSelect={setSelectedId}
                                query={nodeQuery}
                            />
                            {nodes.length === 0 && (
                                <div className="gn-graph-empty">
                                    <EmptyState
                                        icon={<GitBranch size={20}/>}
                                        title="No :User nodes"
                                        description="The graph is empty. Create an account or load the sample network, then refresh."
                                        action={
                                            <button type="button" className="gn-btn gn-btn-secondary gn-btn-sm" onClick={() => void load()}>
                                                Refresh
                                            </button>
                                        }
                                    />
                                </div>
                            )}
                            <GraphDetailPanel
                                node={selectedNode}
                                stats={selectedStats}
                                onClear={() => setSelectedId(null)}
                                onFocus={() => {
                                    if (selectedId) graphRef.current?.focusNode(selectedId);
                                }}
                            />
                        </div>

                        <UsersTable users={data.users} selectedNodeId={selectedId}/>
                    </>
                )}
            </div>
        </div>
    );
}
