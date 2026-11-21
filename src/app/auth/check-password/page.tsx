"use client";

import {useRouter} from "next/navigation";
import React, {useEffect, useRef, useState} from "react";
import {signIn} from "next-auth/react";
import Link from "next/link";
import {CircleAlert, Eye, EyeOff, Loader2} from "lucide-react";
import {useAuthStore} from "@/stores/authStore";
import AuthFormWrapper from "@/components/Auth/AuthFormWrapper";
import {EMAIL_INVALID_MESSAGE, isValidEmail} from "@/lib/validation";

export default function CheckPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [show, setShow] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const passwordRef = useRef<HTMLInputElement>(null);
    const {email} = useAuthStore((state) => state.formData);
    const setEmailError = useAuthStore((state) => state.setEmailError);

    // The email lives in memory only; after a page refresh start again, and any
    // address step 1 would reject goes back there rather than being shown here.
    useEffect(() => {
        if (!email) {
            router.replace("/auth/login");
            return;
        }
        if (!isValidEmail(email)) {
            setEmailError(EMAIL_INVALID_MESSAGE);
            router.replace("/auth/login");
        }
    }, [email, router, setEmailError]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await signIn("credentials", {redirect: false, email, password});
            if (!res || res.error) {
                setError("That password does not match this account.");
                // Clear the rejected password so the next attempt starts from an empty box.
                setPassword("");
                passwordRef.current?.focus();
                return;
            }
            // Full-page navigation drops the in-memory password.
            window.location.replace("/");
        } catch {
            setError("Could not sign in. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthFormWrapper>
            <h1 className="gn-auth-title">Enter your password</h1>
            <p className="gn-auth-sub">
                Signing in as <strong>{email}</strong>.
            </p>

            <form onSubmit={handleSubmit} className="gn-auth-body" method="post">
                <div className="gn-field">
                    <div className="gn-auth-inline-actions">
                        <label className="gn-label" htmlFor="auth-pw">Password</label>
                        <Link href="/auth/login" className="gn-auth-textlink">Change email</Link>
                    </div>
                    <div className="gn-pw-wrap">
                        <input
                            id="auth-pw"
                            ref={passwordRef}
                            type={show ? "text" : "password"}
                            name="password"
                            required
                            autoFocus
                            autoComplete="current-password"
                            placeholder="Your password"
                            className={`gn-input${error ? " is-error" : ""}`}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (error) setError("");
                            }}
                        />
                        <button
                            type="button"
                            className="gn-pw-toggle"
                            onClick={() => setShow((v) => !v)}
                            aria-label={show ? "Hide password" : "Show password"}
                            aria-pressed={show}
                        >
                            {show ? <EyeOff size={15}/> : <Eye size={15}/>}
                        </button>
                    </div>
                    {error && <div className="gn-err"><CircleAlert size={14}/>{error}</div>}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="gn-btn gn-btn-primary gn-btn-lg gn-btn-block"
                >
                    {loading ? <><Loader2 size={16} className="gn-spin"/>Signing in…</> : "Sign in"}
                </button>
            </form>
        </AuthFormWrapper>
    );
}
