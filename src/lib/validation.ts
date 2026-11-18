/**
 * One email rule for the whole app: the first sign-in step and both auth APIs use it,
 * so step 1 can never accept an address the server would reject later, and the user
 * only ever reads the email error on step 1.
 */
export const EMAIL_MAX = 254;

/** The single wording for a bad address, so every step says the same thing. */
export const EMAIL_INVALID_MESSAGE = "Enter a valid email address, like you@company.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
    const email = normalizeEmail(value);
    return email.length > 0 && email.length <= EMAIL_MAX && EMAIL_RE.test(email);
}
