'use client'
import {usePathname} from "next/navigation";
import {ReactNode} from "react";

// The header is hidden on the sign-in / sign-up screens.
export default function ShowHeader({children}: {children: ReactNode}) {
    const pathname = usePathname();
    if (pathname.startsWith("/auth")) return null;
    return <>{children}</>;
}
