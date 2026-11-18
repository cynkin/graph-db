"use client";

import {useRouter} from "next/navigation";
import type {Person} from "@/components/people/types";
import {byDegree, displayDegree, initials, plural} from "@/components/people/helpers";

const W = 640;
const H = 300;
const CX = W / 2;
const CY = H / 2;
const RADII: Record<1 | 2 | 3, number> = {1: 78, 2: 112, 3: 138};
const MAX_PER_RING = 30;

type Plot = {person: Person; angle: number; radius: number};


function place(people: Person[], degree: 1 | 2 | 3, offset: number): Plot[] {
    const list = people.slice(0, MAX_PER_RING);
    return list.map((person, i) => ({
        person,
        angle: -Math.PI / 2 + offset + (i / Math.max(list.length, 1)) * Math.PI * 2,
        radius: RADII[degree],
    }));
}

/**
 * Radius encodes distance from you. Only real people from /api/network are plotted.
 *
 * The network API does not return edges between other people (those live behind the
 * admin graph endpoint), so this map draws spokes from you to your 1st degree and
 * concentric bands for 2nd and 3rd. It never invents peer-to-peer ties.
 */
export default function OrbitMap({people, meName}: {people: Person[]; meName: string}) {
    const router = useRouter();
    const buckets = byDegree(people);
    const first = [...buckets.first].sort((a, b) => a.name.localeCompare(b.name));
    const second = [...buckets.second].sort((a, b) => b.mutual - a.mutual || a.name.localeCompare(b.name));
    const third = [...buckets.third].sort((a, b) => b.mutual - a.mutual || a.name.localeCompare(b.name));

    const plots = [
        ...place(first, 1, 0),
        ...place(second, 2, 0.24),
        ...place(third, 3, 0.55),
    ];

    const xy = (p: Plot) => ({
        x: CX + Math.cos(p.angle) * p.radius,
        y: CY + Math.sin(p.angle) * p.radius,
    });

    const open = (person: Person) =>
        router.push(`/connections?user_id=${encodeURIComponent(person.id)}`);

    return (
        <div className="gn-orbit">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="xMidYMid slice"
                role="img"
                aria-label={`Network map: ${plural(first.length, "first degree connection")}, ${plural(second.length, "second degree connection")}, ${plural(third.length, "third degree connection")}.`}
            >
                <circle className="orb-ring r1" cx={CX} cy={CY} r={RADII[1]}/>
                <circle className="orb-ring" cx={CX} cy={CY} r={RADII[2]}/>
                <circle className="orb-ring" cx={CX} cy={CY} r={RADII[3]}/>

                {place(first, 1, 0).map((p) => {
                    const q = xy(p);
                    return (
                        <line
                            key={`spoke-${p.person.id}`}
                            className="spoke"
                            x1={CX}
                            y1={CY}
                            x2={q.x.toFixed(1)}
                            y2={q.y.toFixed(1)}
                        />
                    );
                })}

                {plots.map((p) => {
                    const q = xy(p);
                    const d = displayDegree(p.person);
                    const degree = (d === 2 ? 2 : d === 3 ? 3 : 1) as 1 | 2 | 3;
                    const label = `${degree} degree, ${plural(p.person.mutual, "mutual")}`;
                    return (
                        <g
                            key={p.person.id}
                            className="orb-node"
                            role="link"
                            tabIndex={0}
                            aria-label={`${p.person.name}, ${label}`}
                            onClick={() => open(p.person)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    open(p.person);
                                }
                            }}
                        >
                            <title>{`${p.person.name} — ${label}`}</title>
                            <circle
                                className={`orb-node-body n${degree}`}
                                cx={q.x.toFixed(1)}
                                cy={q.y.toFixed(1)}
                                r={14}
                            />
                            <text
                                className="orb-node-ini"
                                x={q.x.toFixed(1)}
                                y={(q.y + 3).toFixed(1)}
                                textAnchor="middle"
                            >
                                {initials(p.person.name)}
                            </text>
                        </g>
                    );
                })}

                <g aria-hidden="true">
                    <circle className="orb-center" cx={CX} cy={CY} r={22}/>
                    <text
                        className="orb-center-ini"
                        x={CX}
                        y={CY + 3.5}
                        textAnchor="middle"
                    >
                        {initials(meName)}
                    </text>
                    <title>You</title>
                </g>
            </svg>
        </div>
    );
}
