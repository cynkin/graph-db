import type {Person} from "@/components/people/types";

const TINTS = 8;

/** Two letters for the avatar: first + last initial, or the first two letters of one name. */
export function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Deterministic avatar tint, so a person keeps the same colour everywhere. */
export function tint(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 9973;
    return `t${h % TINTS}`;
}

export function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
}

export function plural(n: number, one: string, many?: string): string {
    return `${n} ${n === 1 ? one : many ?? `${one}s`}`;
}

/**
 * A connected person is always 1st degree, even if the network payload was fetched
 * a moment before an accept. This keeps the badge honest during the refresh window.
 */
export function displayDegree(p: Person): number | null {
    if (p.status === "self") return 0;
    if (p.status === "connected") return 1;
    return p.degree;
}

export function degreePhrase(degree: number | null): string {
    if (degree === null) return "not in your network yet";
    if (degree === 0) return "you";
    return `${degree}${degree === 1 ? "st" : degree === 2 ? "nd" : "rd"} degree connection`;
}

export function metaLine(p: Person): string {
    if (p.status === "self") return "This is you";
    if (p.status === "received") return "Wants to connect with you";
    if (p.mutual > 0) return plural(p.mutual, "mutual connection");
    if (p.degree === null) return "Not in your network yet";
    if (p.status === "connected") return "1st degree connection";
    return "No mutual connections";
}

export type PeopleSort = "distance" | "mutual" | "name";

const distance = (p: Person) => displayDegree(p) ?? 99;

export function sortPeople(people: Person[], sort: PeopleSort): Person[] {
    const list = [...people];
    if (sort === "name") return list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "mutual") {
        return list.sort((a, b) =>
            b.mutual - a.mutual || distance(a) - distance(b) || a.name.localeCompare(b.name)
        );
    }
    return list.sort((a, b) =>
        distance(a) - distance(b) || b.mutual - a.mutual || a.name.localeCompare(b.name)
    );
}

export type DegreeBuckets = {
    all: Person[];
    first: Person[];
    second: Person[];
    third: Person[];
};

export function byDegree(people: Person[]): DegreeBuckets {
    return {
        all: people,
        first: people.filter((p) => displayDegree(p) === 1),
        second: people.filter((p) => displayDegree(p) === 2),
        third: people.filter((p) => displayDegree(p) === 3),
    };
}

/** People worth suggesting: 2nd/3rd degree, no pending request, strongest mutual overlap first. */
export function suggestedPeople(people: Person[], limit = 3): Person[] {
    const candidates = people.filter(
        (p) => p.status === "none" && (displayDegree(p) === 2 || displayDegree(p) === 3)
    );
    const withMutuals = candidates.filter((p) => p.mutual > 0);
    const pool = withMutuals.length >= limit ? withMutuals : candidates;
    return sortPeople(pool, "mutual").slice(0, limit);
}
