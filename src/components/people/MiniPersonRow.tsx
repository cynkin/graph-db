import Link from "next/link";
import {ChevronRight} from "lucide-react";
import type {Person} from "@/components/people/types";
import {metaLine} from "@/components/people/helpers";
import {AvatarRing, DegreeDot} from "@/components/UI/Avatar";

/** A compact, clickable row used inside the dashboard's degree columns. */
export default function MiniPersonRow({person}: {person: Person}) {
    return (
        <Link
            className="gn-mini-row"
            href={`/connections?user_id=${encodeURIComponent(person.id)}`}
            aria-label={`Open ${person.name}'s profile`}
        >
            <AvatarRing
                name={person.name}
                degree={person.degree}
                status={person.status}
                size="sm"
            />
            <span className="gn-mini-txt">
                <span className="gn-mini-name">
                    {person.name}
                    <DegreeDot status={person.status} degree={person.degree}/>
                </span>
                <span className="gn-mini-sub">{metaLine(person)}</span>
            </span>
            <span className="gn-mini-arrow"><ChevronRight size={14}/></span>
        </Link>
    );
}
