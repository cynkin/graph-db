import {getServerSession, NextAuthOptions} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import {comparePasswords} from "@/lib/hash";
import {runQuery} from "@/lib/db";
import {findUserByEmail} from "@/lib/sql";
import {ensureSetup} from "@/lib/setup";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: {label: "Email", type: "email"},
                password: {label: "Password", type: "password"},
            },
            async authorize(credentials) {
                if (!credentials?.password || !credentials?.email) return null;
                const email = credentials.email.trim().toLowerCase();

                // 1. Credentials are checked against the relational database.
                await ensureSetup();
                const row = findUserByEmail(email);
                if (!row || !(await comparePasswords(credentials.password, row.password_hash))) return null;

                // Admins only manage the databases; they are not part of the network (no graph node).
                if (row.role === "admin") return {id: row.id, name: "Admin", email: row.email, role: "admin"};

                // 2. The profile (display name) lives on the graph node with the same id.
                const result = await runQuery(`MATCH (u:User {id: $id}) RETURN u.name AS name`, {id: row.id});
                if (result.records.length === 0) return null;

                return {id: row.id, name: result.records[0].get("name"), email: row.email, role: row.role};
            },
        }),
    ],
    pages: {
        signIn: "/auth/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60,
        updateAge: 24 * 60 * 60,
    },
    callbacks: {
        async jwt({token, user}) {
            if (user) {
                token.id = user.id;
                token.email = user.email!;
                token.name = user.name!;
                token.role = user.role ?? "user";
            }
            if (!token.id && token.sub) token.id = token.sub;
            return token;
        },
        async session({session, token}) {
            if (token && session.user) {
                session.user.email = token.email;
                session.user.id = token.id;
                session.user.name = token.name;
                session.user.role = token.role ?? "user";
            }
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
};

/** The signed-in network member's id, or null if not signed in or an admin (admins have no network). */
export async function currentUserId(): Promise<string | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role === "admin") return null;
    return session.user.id;
}

/** True only for signed-in users whose SQL row has role = 'admin'. */
export async function isAdmin(): Promise<boolean> {
    const session = await getServerSession(authOptions);
    return session?.user?.role === "admin";
}
