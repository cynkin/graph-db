import Link from "next/link";
import {ArrowUpRight} from "lucide-react";
import type {Person} from "@/components/people/types";
import {metaLine} from "@/components/people/helpers";
import {AvatarRing, DegreeDot} from "@/components/UI/Avatar";
import ConnectionActions from "@/components/people/ConnectionActions";

export default function PersonCard({
    person,
    onChanged,
}: {
    person: Person;
    onChanged?: () => void;
}) {
    const href = `/connections?user_id=${encodeURIComponent(person.id)}`;
    return (
        <article className="gn-person">
            <div className="gn-person-top">
                <AvatarRing
                    name={person.name}
                    degree={person.degree}
                    status={person.status}
                    size="lg"
                />
                <div className="gn-person-id">
                    <Link className="gn-person-name" href={href} title={person.name}>
                        {person.name}
                    </Link>
                    <div className="gn-person-meta">{metaLine(person)}</div>
                </div>
            </div>
            <span className="gn-person-badge">
                <DegreeDot status={person.status} degree={person.degree}/>
            </span>
            <div className="gn-person-b">
                <Link className="gn-btn gn-btn-ghost gn-btn-xs" href={href}>
                    View profile
                    <ArrowUpRight size={12}/>
                </Link>
                <span className="gn-spacer"/>
                <ConnectionActions person={person} onChanged={onChanged} size="xs"/>
            </div>
        </article>
    );
}
