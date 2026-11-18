"use client";

import {Moon, Sun} from "lucide-react";
import {useTheme} from "@/components/theme/ThemeProvider";

/**
 * The visible icon is driven by the `data-theme` attribute on <html>, so it is
 * correct on the very first paint (the head bootstrap sets that attribute).
 */
export default function ThemeToggle({className = ""}: {className?: string}) {
    const {toggleTheme} = useTheme();

    return (
        <button
            type="button"
            className={`gn-iconbtn gn-theme-toggle ${className}`}
            onClick={toggleTheme}
            aria-label="Switch between light and dark theme"
            title="Switch theme"
        >
            <Moon size={16} className="theme-moon" aria-hidden="true"/>
            <Sun size={16} className="theme-sun" aria-hidden="true"/>
        </button>
    );
}
