"use client";

import {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";

export type Theme = "light" | "dark";

type ThemeContextValue = {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
};

const STORAGE_KEY = "graphnet-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function themeFromDocument(): Theme {
    if (typeof document === "undefined") return "light";
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** Light is the product default. The only source of a dark start is an explicit saved choice. */
export function ThemeProvider({children}: {children: React.ReactNode}) {
    const [theme, setThemeState] = useState<Theme>("light");

    const apply = useCallback((next: Theme, persist: boolean) => {
        const root = document.documentElement;
        root.setAttribute("data-theme", next);
        root.style.colorScheme = next;
        setThemeState(next);
        if (!persist) return;
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Private mode or storage disabled: the session still switches correctly.
        }
    }, []);

    useEffect(() => {
        apply(themeFromDocument(), false);

        const onStorage = (event: StorageEvent) => {
            if (event.key !== STORAGE_KEY) return;
            if (event.newValue === "light" || event.newValue === "dark") {
                apply(event.newValue, false);
            }
        };

        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, [apply]);

    const toggleTheme = useCallback(() => {
        apply(themeFromDocument() === "light" ? "dark" : "light", true);
    }, [apply]);

    const setTheme = useCallback((next: Theme) => {
        apply(next, true);
    }, [apply]);

    const value = useMemo<ThemeContextValue>(() => ({theme, toggleTheme, setTheme}), [theme, toggleTheme, setTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (!context) throw new Error("useTheme must be used inside ThemeProvider");
    return context;
}
