import {DefaultUser} from "next-auth";

type Role = "user" | "admin";

declare module "next-auth" {
    interface User {
        role?: Role;
    }

    interface Session {
        user: {
            id: string;
            email: string;
            name?: string;
            role: Role;
        } & DefaultUser;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        email: string;
        name?: string;
        role?: Role;
    }
}
