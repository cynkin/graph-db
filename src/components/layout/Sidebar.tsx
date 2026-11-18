"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {Compass, Inbox, LayoutDashboard, Users, X} from "lucide-react";
import BrandMark from "@/components/UI/BrandMark";
import {useNetwork} from "@/components/network/NetworkProvider";

const NAV = [
    {href: "/", label: "Overview", icon: LayoutDashboard},
    {href: "/network", label: "My network", icon: Users},
    {href: "/discover", label: "Discover", icon: Compass},
    {href: "/requests", label: "Requests", icon: Inbox},
];

export default function Sidebar({open, onClose}: {open: boolean; onClose: () => void}) {
    const pathname = usePathname();
    const {counts, refresh} = useNetwork();

    return (
        <aside className={`gn-side${open ? " is-open" : ""}`} id="gn-side" aria-label="Primary navigation">
            <div className="gn-brand">
                <div style={{display: "flex", alignItems: "center", gap: 9}}>
                    <BrandMark size={26} className="gn-brand-mark"/>
                    <span className="gn-wordmark">GraphNet</span>
                </div>
                <button
                    type="button"
                    className="gn-side-close"
                    onClick={onClose}
                    aria-label="Close navigation"
                >
                    <X size={16}/>
                </button>
            </div>

            <nav className="gn-nav" aria-label="Workspace">
                <div className="gn-nav-label">Workspace</div>
                {NAV.map((item) => {
                    const active = pathname === item.href
                        || (item.href === "/network" && pathname === "/connections");
                    const Icon = item.icon;
                    const badge = item.href === "/requests" ? counts.received : 0;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`gn-nav-item${active ? " is-active" : ""}`}
                            aria-current={active ? "page" : undefined}
                            onClick={() => {
                                // Clicking the tab you are already on still re-reads the graph.
                                if (pathname === item.href) void refresh();
                            }}
                        >
                            <span className="gn-nav-ico"><Icon size={17}/></span>
                            {item.label}
                            {badge > 0 && <span className="gn-nav-badge">{badge}</span>}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
