'use client'
import {Search} from "lucide-react";
import React from "react";
import {useRouter} from "next/navigation";
import {useSession} from "next-auth/react";

export default function SearchBar() {
    const router = useRouter();
    const {data: session} = useSession();
    const search = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const q = (new FormData(e.currentTarget).get("q") as string).trim();
        router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
    }

    // The admin has no network to search: keep the header layout, hide the box.
    if (session?.user.role === "admin") return <div className="w-full"/>;

    return (
        <div className="w-full">
            <form onSubmit={search} className="flex">
                <div className="relative flex mx-5 items-center w-full">
                    <input type="text"
                           name="q"
                           placeholder="Search people..."
                           className="w-full border my-2 py-3 pl-12 text-sm tracking-wide border-gray-300 rounded-3xl
                           shadow-xs focus:outline-none focus:ring-2 focus:ring-[#5423e7] hover:shadow-md focus:shadow-xl
                           focus:border-transparent transition-all duration-200"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2"/>
                    <button type="submit" className="h-fit ml-2 rounded-3xl text-sm cursor-pointer text-white px-4 py-3 bg-primary">Search</button>
                </div>
            </form>
        </div>
    )
}
