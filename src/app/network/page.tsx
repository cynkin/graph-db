import type {Metadata} from "next";
import {Suspense} from "react";
import NetworkView from "@/components/network/NetworkView";
import {PageLoading} from "@/components/UI/States";

export const metadata: Metadata = {
    title: "My network",
};

export default function NetworkPage() {
    return (
        <Suspense fallback={<PageLoading label="Loading your network…"/>}>
            <NetworkView/>
        </Suspense>
    );
}
