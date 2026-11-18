"use client";

import {useRouter} from "next/navigation";
import React, {useEffect, useState} from "react";
import Link from "next/link";
import {Check, Dot, Eye, EyeOff} from "lucide-react";
import AuthFormWrapper from "@/components/Auth/AuthFormWrapper";
import {useAuthStore} from "@/stores/authStore";
import {EMAIL_INVALID_MESSAGE, isValidEmail} from "@/lib/validation";

const getStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 6) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[\W_]/.test(pwd)) score++;
    return score;
};

const LABELS = ["Too short", "Weak", "Fair", "Strong", "Very strong"];

export default function CreatePasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [show, setShow] = useState(false);
    const {formData: {email}, setFormData, setEmailError} = useAuthStore();

    // Step 1 is the only place an email error belongs, so a bad stored address goes
    // back there instead of letting the user set a password for it.
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

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!canContinue) return;
        setFormData({password});
        router.push("/auth/register");
    }

    const strength = getStrength(password);
    const canContinue = password.length >= 6 && password.length <= 64 && strength >= 2;
    const strengthColor = strength >= 3
        ? "var(--success)"
        : strength === 2
            ? "var(--accent)"
            : "var(--error)";

    const rules = [
        {label: "6 to 64 characters", ok: password.length >= 6 && password.length <= 64},
        {label: "Combines letters and numbers", ok: /[a-zA-Z]/.test(password) && /\d/.test(password)},
        {label: "One special character ~ # @ $ % & ! * _ ? ^ -", ok: /[\W_]/.test(password)},
    ];

    return (
        <AuthFormWrapper step={2}>
            <h1 className="gn-auth-title">Create a password</h1>
            <p className="gn-auth-sub">
                New account for <strong>{email}</strong>.{" "}
                <Link href="/auth/login" className="gn-auth-textlink">Change email</Link>
            </p>

            <form onSubmit={handleSubmit} className="gn-auth-body" method="post">
                <div className="gn-field">
                    <label className="gn-label" htmlFor="auth-new">Password</label>
                    <div className="gn-pw-wrap">
                        <input
                            id="auth-new"
                            type={show ? "text" : "password"}
                            name="password"
                            autoFocus
                            autoComplete="new-password"
                            maxLength={64}
                            placeholder="6 to 64 characters"
                            className="gn-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
                </div>

                <div>
                    <div className="gn-flex gn-ic" style={{justifyContent: "space-between"}}>
                        <span className="gn-hint">Password strength</span>
                        <span className="gn-tiny" style={{fontWeight: 600, color: strengthColor}}>
                            {LABELS[strength] ?? "Too short"}
                        </span>
                    </div>
                    <div className="gn-meter" style={{marginTop: 7}}>
                        <i style={{
                            width: `${(strength / 4) * 100}%`,
                            background: strengthColor,
                        }}/>
                    </div>
                </div>

                <ul className="gn-check-list">
                    {rules.map((rule) => (
                        <li key={rule.label} className={rule.ok ? "is-on" : ""}>
                            <span className="ck">
                                {rule.ok ? <Check size={13}/> : <Dot size={13}/>}
                            </span>
                            {rule.label}
                        </li>
                    ))}
                </ul>

                <button
                    type="submit"
                    disabled={!canContinue}
                    className="gn-btn gn-btn-primary gn-btn-lg gn-btn-block"
                >
                    Continue
                </button>
            </form>
        </AuthFormWrapper>
    );
}
