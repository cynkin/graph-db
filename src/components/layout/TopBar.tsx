"use client";

import {Menu} from "lucide-react";
import UserMenu from "@/components/layout/UserMenu";

export default function TopBar({onMenu}: {onMenu: () => void}) {
    return (
        <header className="gn-top">
            <button
                type="button"
                className="gn-iconbtn gn-menu-btn"
                onClick={onMenu}
                aria-label="Open navigation"
            >
                <Menu size={18}/>
            </button>

            <div className="gn-top-right">
                <UserMenu/>
            </div>
        </header>
    );
}
