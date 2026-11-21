"use client";

import {useState} from "react";
import {Check, Loader2, UserMinus, UserPlus} from "lucide-react";
import type {ConnectionAction, Person} from "@/components/people/types";
import {useNetwork} from "@/components/network/NetworkProvider";
import {useToast} from "@/components/UI/Toast";
import ConfirmDialog from "@/components/UI/ConfirmDialog";

type Props = {
    person: Person;
    onChanged?: () => void;
    size?: "sm" | "xs";
    /** Show a static "Connected" label instead of the remove action (lists owned by someone else). */
    protectConnected?: boolean;
    className?: string;
};

const MESSAGES: Record<ConnectionAction, string> = {
    request: "Connection request sent.",
    accept: "Connection accepted.",
    ignore: "Request ignored.",
    remove: "Connection removed.",
};

function successMessage(action: ConnectionAction, person: Person): string {
    if (action === "remove" && person.status !== "connected") return "Request withdrawn.";
    return MESSAGES[action];
}

export default function ConnectionActions({
    person,
    onChanged,
    size = "sm",
    protectConnected = false,
    className = "",
}: Props) {
    const {act, isBusy} = useNetwork();
    const {push} = useToast();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const busy = isBusy(person.id);
    const btn = size === "xs" ? "gn-btn-xs" : "gn-btn-sm";

    const run = async (action: ConnectionAction) => {
        const result = await act(person, action);
        if (result.ok) {
            push(successMessage(action, person));
            onChanged?.();
        } else {
            push(result.error ?? "The connection could not be updated.", "warn");
        }
    };

    const remove = () => {
        if (person.status === "connected") {
            setConfirmOpen(true);
            return;
        }
        void run("remove");
    };

    const confirmRemove = async () => {
        const result = await act(person, "remove");
        setConfirmOpen(false);
        if (result.ok) {
            push("Connection removed.");
            onChanged?.();
        } else {
            push(result.error ?? "The connection could not be removed.", "warn");
        }
    };

    return (
        <div className={`gn-flex gn-ic gn-gap-6 gn-flex-wrap ${className}`}>
            {person.status === "none" && (
                <button
                    type="button"
                    className={`gn-btn gn-btn-primary ${btn}`}
                    onClick={() => void run("request")}
                    disabled={busy}
                >
                    {busy
                        ? <Loader2 size={13} className="gn-spin"/>
                        : <UserPlus size={13}/>}
                    Connect
                </button>
            )}

            {person.status === "sent" && (
                <>
                    <span className="gn-deg gn-deg-0" style={{height: 22}}>Pending</span>
                    <button
                        type="button"
                        className={`gn-btn gn-btn-quiet ${btn}`}
                        onClick={remove}
                        disabled={busy}
                        title="Withdraw this connection request"
                    >
                        {busy ? <Loader2 size={12} className="gn-spin"/> : null}
                        Withdraw
                    </button>
                </>
            )}

            {person.status === "received" && (
                <>
                    <button
                        type="button"
                        className={`gn-btn gn-btn-secondary ${btn}`}
                        onClick={() => void run("ignore")}
                        disabled={busy}
                    >
                        Ignore
                    </button>
                    <button
                        type="button"
                        className={`gn-btn gn-btn-primary ${btn}`}
                        onClick={() => void run("accept")}
                        disabled={busy}
                    >
                        {busy
                            ? <Loader2 size={13} className="gn-spin"/>
                            : <Check size={13}/>}
                        Accept
                    </button>
                </>
            )}

            {person.status === "connected" && (
                protectConnected
                    ? <span className="gn-tiny gn-dim">Connected</span>
                    : (
                        <button
                            type="button"
                            className={`gn-btn gn-btn-ghost gn-btn-danger ${btn}`}
                            onClick={remove}
                            disabled={busy}
                        >
                            {busy
                                ? <Loader2 size={13} className="gn-spin"/>
                                : <UserMinus size={13}/>}
                            Remove
                        </button>
                    )
            )}

            <ConfirmDialog
                open={confirmOpen}
                title="Remove connection?"
                body={
                    <>
                        <strong style={{color: "var(--text-primary)"}}>{person.name}</strong> will be removed from
                        your connections. The <span className="gn-mono">CONNECTED</span> edge is deleted, and
                        either of you can send a new request later.
                    </>
                }
                confirmLabel="Remove connection"
                busy={busy}
                onConfirm={() => void confirmRemove()}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    );
}
