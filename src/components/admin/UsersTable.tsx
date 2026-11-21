"use client";

import {useEffect, useMemo, useState} from "react";
import {ArrowLeft, ArrowRight, Link2, Search} from "lucide-react";
import type {AdminUser} from "@/components/people/types";

const PAGE_SIZE = 8;

export default function UsersTable({
    users,
    selectedNodeId,
}: {
    users: AdminUser[];
    selectedNodeId: string | null;
}) {
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(0);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return users;
        return users.filter((u) =>
            u.email.toLowerCase().includes(q)
            || u.id.toLowerCase().includes(q)
        );
    }, [users, query]);

    useEffect(() => {
        setPage(0);
    }, [query, users]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const current = Math.min(page, pageCount - 1);
    const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
    const linked = selectedNodeId ? filtered.find((u) => u.id === selectedNodeId) : undefined;

    const pageNumbers = useMemo(() => {
        const window = 5;
        let start = Math.max(0, current - Math.floor(window / 2));
        const end = Math.min(pageCount, start + window);
        start = Math.max(0, end - window);
        return Array.from({length: end - start}, (_, i) => start + i);
    }, [current, pageCount]);

    return (
        <section className="gn-admin-table" aria-label="SQLite users table">
            <div className="gn-admin-table-bar">
                <span className="gn-table-title">users</span>
                <span className="gn-table-sub">SQLite · relational</span>
                <span className="gn-table-meta">
                    {filtered.length} of {users.length} rows · page {current + 1} of {pageCount}
                </span>
                {linked && (
                    <span className="gn-tiny gn-dim gn-flex gn-ic gn-gap-6">
                        <Link2 size={12}/>selected node ↔ this row
                    </span>
                )}
                <div className="gn-search is-sm" style={{marginLeft: "auto", maxWidth: 210, height: 28}}>
                    <span className="gn-search-ico"><Search size={12}/></span>
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Filter users"
                        aria-label="Filter SQLite users"
                        style={{fontSize: 11.5}}
                    />
                </div>
                <div className="gn-pagination">
                    <button
                        type="button"
                        className="gn-page-btn"
                        onClick={() => setPage(Math.max(0, current - 1))}
                        disabled={current === 0}
                        aria-label="Previous page"
                    >
                        <ArrowLeft size={12}/>
                    </button>
                    {pageNumbers.map((p) => (
                        <button
                            type="button"
                            key={p}
                            className={`gn-page-btn${p === current ? " is-active" : ""}`}
                            onClick={() => setPage(p)}
                            aria-label={`Page ${p + 1}`}
                            aria-current={p === current ? "page" : undefined}
                        >
                            {p + 1}
                        </button>
                    ))}
                    <button
                        type="button"
                        className="gn-page-btn"
                        onClick={() => setPage(Math.min(pageCount - 1, current + 1))}
                        disabled={current >= pageCount - 1}
                        aria-label="Next page"
                    >
                        <ArrowRight size={12}/>
                    </button>
                </div>
            </div>

            <div className="gn-table-wrap">
                <table className="gn-table">
                    <thead>
                        <tr>
                            <th style={{width: 190}}>id</th>
                            <th>email</th>
                            <th style={{width: 170}}>created_at</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="gn-table-empty">
                                    No users match this filter.
                                </td>
                            </tr>
                        ) : rows.map((u) => (
                            <tr key={u.id} className={u.id === selectedNodeId ? "is-linked" : undefined}>
                                <td className="cell-id" title={u.id}>{u.id}</td>
                                <td className="cell-strong">{u.email}</td>
                                <td className="cell-num cell-muted">{u.created_at}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
