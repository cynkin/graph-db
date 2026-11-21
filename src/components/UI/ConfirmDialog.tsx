"use client";

import {useEffect, useId, useRef} from "react";
import {AlertTriangle, X} from "lucide-react";

type Props = {
    open: boolean;
    title: string;
    body: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

/** Accessible confirmation dialog for destructive actions (removing a connection). */
export default function ConfirmDialog({
    open,
    title,
    body,
    confirmLabel = "Remove",
    cancelLabel = "Cancel",
    busy = false,
    onConfirm,
    onCancel,
}: Props) {
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const onCancelRef = useRef(onCancel);
    onCancelRef.current = onCancel;

    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement as HTMLElement | null;
        cancelRef.current?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onCancelRef.current();
                return;
            }
            if (e.key !== "Tab") return;
            const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (!nodes || nodes.length === 0) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = overflow;
            previous?.focus();
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="gn-modal-veil" onMouseDown={() => {if (!busy) onCancel();}}>
            <div
                ref={dialogRef}
                className="gn-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="gn-modal-title" id={titleId}>
                    <span className="ico-danger"><AlertTriangle size={17}/></span>
                    {title}
                </div>
                <div className="gn-dialog-body">{body}</div>
                <div className="gn-dialog-actions">
                    <button
                        ref={cancelRef}
                        type="button"
                        className="gn-btn gn-btn-secondary"
                        onClick={onCancel}
                        disabled={busy}
                    >
                        <X size={14}/>{cancelLabel}
                    </button>
                    <button
                        type="button"
                        className="gn-btn gn-btn-primary"
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {busy ? "Removing…" : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
