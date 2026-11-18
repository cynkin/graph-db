import {withAuth} from "next-auth/middleware";
import {NextResponse} from "next/server";

// Signed-out visitors go to /auth/login.
// The admin manages the databases (no network), so it always lands on /admin;
// regular users can't open /admin.
export default withAuth(
    function middleware(req) {
        const isAdmin = req.nextauth.token?.role === "admin";
        const onAdmin = req.nextUrl.pathname.startsWith("/admin");
        if (isAdmin && !onAdmin) return NextResponse.redirect(new URL("/admin", req.url));
        if (!isAdmin && onAdmin) return NextResponse.redirect(new URL("/", req.url));
        return NextResponse.next();
    },
    {pages: {signIn: "/auth/login"}}
);

export const config = {
    matcher: ["/", "/connections", "/admin"],
};
