"use client";

import React, {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {signIn} from "next-auth/react";
import {CircleAlert, GitBranch, Loader2} from "lucide-react";
import AuthFormWrapper from "@/components/Auth/AuthFormWrapper";
import {useAuthStore} from "@/stores/authStore";
import {AvatarRing} from "@/components/UI/Avatar";
import {EMAIL_INVALID_MESSAGE, isValidEmail} from "@/lib/validation";

const NAME_LENGTH_MESSAGE = "Name must be 3-60 characters long";

export default function RegisterPage() {
    const router = useRouter();
    const {email, password} = useAuthStore((state) => state.formData);
    const setEmailError = useAuthStore((state) => state.setEmailError);
    const [name, setName] = useState("");
    // Kept apart on purpose: a name problem belongs under the name field, anything
    // about the account as a whole belongs at the bottom of the form.
    const [nameError, setNameError] = useState("");
    const [formError, setFormError] = useState("");
    const [loading, setLoading] = useState(false);

    // An address that step 1 would reject must never be carried this far.
    useEffect(() => {
        if (!email || !password) {
            router.replace("/auth/login");
            return;
        }
        if (!isValidEmail(email)) {
            setEmailError(EMAIL_INVALID_MESSAGE);
            router.replace("/auth/login");
        }
    }, [email, password, router, setEmailError]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const raw = new FormData(e.currentTarget).get("name");
        const trimmed = (typeof raw === "string" ? raw : name).trim();
        setNameError("");
        setFormError("");

        if (trimmed.length < 3 || trimmed.length > 60) {
            setNameError(NAME_LENGTH_MESSAGE);
            return;
        }

        // Last line of defence: report a bad address on step 1, never here.
        if (!isValidEmail(email ?? "")) {
            setEmailError(EMAIL_INVALID_MESSAGE);
            router.replace("/auth/login");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({email, name: trimmed, password}),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({} as {error?: string; field?: string}));
                if (data.field === "email") {
                    // Send it back to the step that owns the email field.
                    setEmailError(data.error ?? EMAIL_INVALID_MESSAGE);
                    router.replace("/auth/login");
                    return;
                }
                if (data.field === "name") {
                    setNameError(data.error ?? NAME_LENGTH_MESSAGE);
                    return;
                }
                setFormError(data.error ?? "Could not create account");
                return;
            }

            const response = await signIn("credentials", {redirect: false, email, password});
            if (!response || response.error) {
                setFormError("Account created, but sign in failed. Please sign in again.");
                return;
            }
            // Full-page navigation so the in-memory password is dropped.
            window.location.replace("/");
        } catch {
            setFormError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthFormWrapper step={3}>
            <h1 className="gn-auth-title">What should people call you?</h1>
            <p className="gn-auth-sub">
                This name sits on your node in the graph and on every connection card.
            </p>

            <form onSubmit={handleSubmit} className="gn-auth-body" method="post">
                <div className="gn-field">
                    <label className="gn-label" htmlFor="auth-name">Full name</label>
                    <input
                        id="auth-name"
                        type="text"
                        name="name"
                        required
                        autoFocus
                        autoComplete="name"
                        maxLength={60}
                        placeholder="Jordan Mbeki"
                        className={`gn-input${nameError ? " is-error" : ""}`}
                        value={name}
                        aria-invalid={!!nameError}
                        aria-describedby={nameError ? "auth-name-error" : undefined}
                        onChange={(e) => {
                            setName(e.target.value);
                            if (nameError) setNameError("");
                        }}
                    />
                    <span className="gn-hint">Between 3 and 60 characters. Spaces are allowed between names.</span>
                    {nameError && (
                        <div className="gn-err" id="auth-name-error" role="alert">
                            <CircleAlert size={14}/>{nameError}
                        </div>
                    )}
                </div>

                <div className="gn-auth-preview">
                    <AvatarRing
                        name={name.trim() || "New Person"}
                        degree={null}
                        status="none"
                        size="md"
                    />
                    <div style={{minWidth: 0}}>
                        <div className="gn-tiny gn-dim">Your node preview</div>
                        <div style={{fontSize: 12.5, fontWeight: 600, marginTop: 2}}>
                            {name.trim() || "New Person"}
                        </div>
                    </div>
                    <GitBranch size={15} className="gn-dim" style={{marginLeft: "auto"}}/>
                </div>

                {formError && (
                    <div className="gn-err" role="alert">
                        <CircleAlert size={14}/>{formError}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="gn-btn gn-btn-primary gn-btn-lg gn-btn-block"
                >
                    {loading ? <><Loader2 size={16} className="gn-spin"/>Creating account…</> : "Create account"}
                </button>
            </form>

            <p className="gn-auth-foot">
                You start with no connections. Discover people to send your first request.
            </p>
        </AuthFormWrapper>
    );
}
