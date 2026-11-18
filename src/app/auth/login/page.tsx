"use client";

import React, {useEffect, useState} from "react";
import {useAuthStore} from "@/stores/authStore";
import {useRouter} from "next/navigation";
import {EMAIL_INVALID_MESSAGE, isValidEmail, normalizeEmail} from "@/lib/validation";
import AuthFormWrapper from "@/components/Auth/AuthFormWrapper";
import {CircleAlert, Loader2} from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const {
        formData: {email: savedEmail},
        emailError,
        setFormData,
        setEmailError,
        resetFormData,
    } = useAuthStore();
    const [email, setEmail] = useState(savedEmail ?? "");
    // A problem found on step 2 or 3 is handed back here, so an invalid address is
    // only ever reported on step 1, next to the field that owns it.
    const [error, setError] = useState(emailError);
    const [touched, setTouched] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (emailError) setEmailError("");
    }, [emailError, setEmailError]);

    const typed = normalizeEmail(email);
    // Feedback starts on blur, then keeps up while the address is being corrected.
    const inlineError = touched && typed.length > 0 && !isValidEmail(typed) ? EMAIL_INVALID_MESSAGE : "";
    const shownError = error || inlineError;

    async function credLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const raw = new FormData(e.currentTarget).get("email");
        // The DOM value is what the browser (and any autofill) actually holds.
        const value = normalizeEmail(typeof raw === "string" ? raw : email);
        if (value !== email) setEmail(value);

        setTouched(true);
        setEmailError("");
        if (!value) {
            setError("Enter your email address to continue");
            return;
        }
        if (!isValidEmail(value)) {
            setError(EMAIL_INVALID_MESSAGE);
            return;
        }

        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/auth/check-email", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({email: value}),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({} as {error?: string}));
                setError(data.error ?? "Something went wrong. Please try again.");
                return;
            }
            const {exists} = await res.json();
            resetFormData();
            setFormData({email: value});
            router.push(exists ? "/auth/check-password" : "/auth/create-password");
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthFormWrapper>
            <h1 className="gn-auth-title">Sign in or create an account</h1>

            <form onSubmit={credLogin} className="gn-auth-body" method="post" noValidate>
                <div className="gn-field">
                    <label className="gn-label" htmlFor="auth-email">Email</label>
                    <input
                        id="auth-email"
                        name="email"
                        type="email"
                        required
                        autoFocus
                        autoComplete="email"
                        inputMode="email"
                        placeholder="you@company.com"
                        className={`gn-input${shownError ? " is-error" : ""}`}
                        value={email}
                        aria-invalid={!!shownError}
                        aria-describedby={shownError ? "auth-email-error" : undefined}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            if (error) setError("");
                        }}
                        onBlur={() => setTouched(true)}
                    />
                    {shownError && (
                        <div className="gn-err" id="auth-email-error" role="alert">
                            <CircleAlert size={14}/>{shownError}
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="gn-btn gn-btn-primary gn-btn-lg gn-btn-block"
                >
                    {loading ? <><Loader2 size={16} className="gn-spin"/>Checking…</> : "Continue"}
                </button>
            </form>
        </AuthFormWrapper>
    );
}
