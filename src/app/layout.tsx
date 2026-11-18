import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";
import Provider from "@/components/SessionProvider";
import AppChrome from "@/components/layout/AppChrome";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: {
        default: "GraphNet",
        template: "%s · GraphNet",
    },
    description: "A professional network whose shape comes from a Neo4j graph: 1st, 2nd and 3rd degree connections, mutuals, and a live graph console.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${geistSans.variable} ${geistMono.variable} gn`}>
                <Provider>
                    <AppChrome>{children}</AppChrome>
                </Provider>
            </body>
        </html>
    );
}
