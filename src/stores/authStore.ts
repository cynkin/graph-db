import {create} from "zustand";

// Holds the sign-up / sign-in form across the multi-step auth pages (in memory only).
type AuthFormData = {
    email?: string;
    password?: string;
};

type AuthStore = {
    formData: AuthFormData;
    /**
     * A message about the email address, raised on a later step but always shown on
     * step 1 — the only step that owns that field.
     */
    emailError: string;
    setFormData: (data: Partial<AuthFormData>) => void;
    setEmailError: (message: string) => void;
    resetFormData: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
    formData: {},
    emailError: "",
    setFormData: (data) => set((state) => ({formData: {...state.formData, ...data}})),
    setEmailError: (message) => set({emailError: message}),
    resetFormData: () => set({formData: {}, emailError: ""}),
}));
