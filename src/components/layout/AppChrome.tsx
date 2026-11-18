"use client";

import {useEffect} from "react";
import {usePathname, useRouter} from "next/navigation";
import {useSession} from "next-auth/react";
import AppShell from "@/components/layout/AppShell";

/** Routes that render inside the signed-in application shell. */
const APP_ROUTES = new Set(["/", "/network", "/discover", "/requests", "/connections"]);

/**
 * The gate holds a plain backdrop while the session resolves; the shell paints its
 * own skeleton right after, so there is no separate splash screen to sit through.
 */
function Boot() {
    return <div className="gn gn-boot" aria-busy="true"/>;
}

function GuardedApp({children}: {children: React.ReactNode}) {
    const {data: session, status} = useSession();
    const router = useRouter();
    const isAdmin = session?.user?.role === "admin";

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/auth/login");
            return;
        }
        if (status === "authenticated" && isAdmin) {
            router.replace("/admin");
        }
    }, [status, isAdmin, router]);

    if (status !== "authenticated" || isAdmin) {
        return <Boot/>;
    }

    return <AppShell>{children}</AppShell>;
}

export default function AppChrome({children}: {children: React.ReactNode}) {
    const pathname = usePathname();
    if (!APP_ROUTES.has(pathname)) return <>{children}</>;
    return <GuardedApp>{children}</GuardedApp>;
}
