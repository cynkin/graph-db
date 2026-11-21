"use client";

import {createContext, useCallback, useContext, useEffect, useRef, useState} from "react";
import {AlertTriangle, CheckCircle2, X} from "lucide-react";

type Tone = "ok" | "warn";
type ToastItem = {id: number; message: string; tone: Tone};
type ToastApi = {push: (message: string, tone?: Tone) => void};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({children}: {children: React.ReactNode}) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const timers = useRef<number[]>([]);

    useEffect(() => {
        const list = timers.current;
        return () => list.forEach((t) => window.clearTimeout(t));
    }, []);

    const dismiss = useCallback((id: number) => {
        setItems((current) => current.filter((t) => t.id !== id));
    }, []);

    const push = useCallback((message: string, tone: Tone = "ok") => {
        const id = Date.now() + Math.random();
        setItems((current) => [...current.slice(-2), {id, message, tone}]);
        timers.current.push(window.setTimeout(() => dismiss(id), 4400));
    }, [dismiss]);

    return (
        <ToastContext.Provider value={{push}}>
            {children}
            <div className="gn-toasts" aria-live="polite" aria-atomic="false">
                {items.map((t) => (
                    <div key={t.id} className={`gn-toast${t.tone === "warn" ? " is-warn" : ""}`}>
                        <span className={`gn-toast-ico${t.tone === "warn" ? " is-warn" : ""}`}>
                            {t.tone === "warn"
                                ? <AlertTriangle size={15}/>
                                : <CheckCircle2 size={15}/>}
                        </span>
                        <span className="gn-toast-msg">{t.message}</span>
                        <button
                            type="button"
                            className="gn-toast-close"
                            onClick={() => dismiss(t.id)}
                            aria-label="Dismiss notification"
                        >
                            <X size={13}/>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast(): ToastApi {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used inside ToastProvider");
    return ctx;
}
