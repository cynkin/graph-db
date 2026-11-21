import type {ConnectionStatus} from "@/components/people/types";
import {initials, tint} from "@/components/people/helpers";

export type AvatarSize = "sm" | "md" | "lg" | "xl" | "2xl";

export function Avatar({
    name,
    size = "md",
    className = "",
}: {
    name: string;
    size?: AvatarSize;
    className?: string;
}) {
    return (
        <span className={`gn-av gn-av-${size} ${tint(name)} ${className}`} aria-hidden="true">
            {initials(name)}
        </span>
    );
}

/**
 * Avatar inside a solid degree ring: emerald = 1st, amber = 2nd, slate = 3rd.
 * People with no degree in range get no ring; the colour is never reinforced by
 * a dash or dot pattern.
 */
export function AvatarRing({
    name,
    degree,
    status = "none",
    size = "md",
}: {
    name: string;
    degree: number | null;
    status?: ConnectionStatus;
    size?: AvatarSize;
}) {
    const d = status === "self" ? 0 : status === "connected" ? 1 : degree;
    if (d === null) return <Avatar name={name} size={size}/>;
    return (
        <span className={`gn-ring gn-ring-${d}`}>
            <Avatar name={name} size={size}/>
        </span>
    );
}

const DEGREE_NAMES: Record<1 | 2 | 3, string> = {
    1: "1st degree",
    2: "2nd degree",
    3: "3rd degree",
};

/** A colour-only degree marker. The labelled legend lives in the app shell. */
export function DegreeDot({
    status,
    degree,
    className = "",
}: {
    status: ConnectionStatus;
    degree: number | null;
    className?: string;
}) {
    if (status === "self") return <span className="gn-deg gn-deg-self">You</span>;
    const d = status === "connected" ? 1 : degree;
    if (d !== 1 && d !== 2 && d !== 3) return null;
    return (
        <span
            className={`gn-degree-dot k${d}${className ? ` ${className}` : ""}`}
            role="img"
            aria-label={DEGREE_NAMES[d]}
            title={DEGREE_NAMES[d]}
        />
    );
}
