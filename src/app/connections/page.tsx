import type {Metadata} from "next";
import {Suspense} from "react";
import ProfileView from "@/components/profile/ProfileView";
import {PageLoading} from "@/components/UI/States";

export const metadata: Metadata = {
    title: "Profile",
};

export default function ConnectionsPage() {
    return (
        <Suspense fallback={<PageLoading label="Loading profile…"/>}>
            <ProfileView/>
        </Suspense>
    );
}
