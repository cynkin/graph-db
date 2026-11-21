import type {Metadata} from "next";
import RequestsView from "@/components/requests/RequestsView";

export const metadata: Metadata = {
    title: "Requests",
};

export default function RequestsPage() {
    return <RequestsView/>;
}
