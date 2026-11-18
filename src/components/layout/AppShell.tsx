"use client";

import {useEffect, useRef, useState} from "react";
import {usePathname} from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import DegreeLegend from "@/components/layout/DegreeLegend";
import {NetworkProvider} from "@/components/network/NetworkProvider";
import {ToastProvider} from "@/components/UI/Toast";

export default function AppShell({children}: {children: React.ReactNode}) {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMenuOpen(false);
        scrollRef.current?.scrollTo({top: 0});
    }, [pathname]);

    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [menuOpen]);

    return (
        <ToastProvider>
            <NetworkProvider>
                <div className="gn gn-shell" data-mode="app">
                    {menuOpen && (
                        <button
                            type="button"
                            className="gn-side-backdrop"
                            aria-label="Close navigation"
                            onClick={() => setMenuOpen(false)}
                        />
                    )}
                    <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)}/>
                    <div className="gn-main">
                        <TopBar onMenu={() => setMenuOpen(true)}/>
                        <DegreeLegend/>
                        <div className="gn-scroll" id="gn-scroll" ref={scrollRef}>
                            <div className="gn-page">{children}</div>
                        </div>
                    </div>
                </div>
            </NetworkProvider>
        </ToastProvider>
    );
}
