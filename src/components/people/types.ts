export type ConnectionStatus = "self" | "connected" | "sent" | "received" | "none";

/** Shape returned by GET /api/network and GET /api/profile. */
export type Person = {
    id: string;
    name: string;
    degree: number | null;
    mutual: number;
    status: ConnectionStatus;
};

export type ConnectionAction = "request" | "accept" | "ignore" | "remove";

export type ProfileData = {
    person: Person;
    mutual: Person[];
    connections: Person[] | null;
};

export type GraphNode = {id: string; name: string};
export type GraphLink = {source: string; target: string; type: "CONNECTED" | "REQUESTED"};

export type WholeGraph = {
    nodes: GraphNode[];
    links: GraphLink[];
};

export type AdminUser = {
    id: string;
    email: string;
    role: "user" | "admin";
    created_at: string;
};

export type NodeStats = {
    connections: number;
    incoming: number;
    outgoing: number;
};

export type ActionResult = {ok: boolean; error?: string};
