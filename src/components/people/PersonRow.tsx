import Link from "next/link";
import type {Person} from "@/components/people/types";
import {metaLine} from "@/components/people/helpers";
import {AvatarRing, DegreeDot} from "@/components/UI/Avatar";
import ConnectionActions from "@/components/people/ConnectionActions";

export default function PersonRow({
    person,
    onChanged,
    protectConnected = false,
}: {
    person: Person;
    onChanged?: () => void;
    protectConnected?: boolean;
}) {
    const href = `/connections?user_id=${encodeURIComponent(person.id)}`;
    return (
        <div className="gn-row">
            <AvatarRing
                name={person.name}
                degree={person.degree}
                status={person.status}
                size="md"
            />
            <div className="gn-row-txt">
                <div className="gn-row-name">
                    <Link href={href} title={person.name}>{person.name}</Link>
                    <DegreeDot status={person.status} degree={person.degree}/>
                </div>
                <div className="gn-row-sub">{metaLine(person)}</div>
            </div>
            <div className="gn-row-act">
                <ConnectionActions
                    person={person}
                    onChanged={onChanged}
                    size="xs"
                    protectConnected={protectConnected}
                />
            </div>
        </div>
    );
}
