import type {Metadata} from "next";
import {Suspense} from "react";
import DiscoverView from "@/components/discover/DiscoverView";
import {PageLoading} from "@/components/UI/States";

export const metadata: Metadata = {
    title: "Discover people",
};

export default function DiscoverPage() {
    return (
        <Suspense fallback={<PageLoading label="Loading people…"/>}>
            <DiscoverView/>
        </Suspense>
    );
}
