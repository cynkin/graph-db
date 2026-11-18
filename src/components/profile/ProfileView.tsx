"use client";

import {useCallback, useEffect, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {Lock} from "lucide-react";
import {useNetwork} from "@/components/network/NetworkProvider";
import type {ProfileData} from "@/components/people/types";
import {degreePhrase, firstName, plural} from "@/components/people/helpers";
import {AvatarRing, DegreeDot} from "@/components/UI/Avatar";
import ConnectionActions from "@/components/people/ConnectionActions";
import PersonRow from "@/components/people/PersonRow";
import {EmptyState, ErrorState} from "@/components/UI/States";

export default function ProfileView() {
    const params = useSearchParams();
    const router = useRouter();
    const {me, counts, loading: networkLoading} = useNetwork();

    const rawId = params.get("user_id");
    const id = rawId ?? me?.id ?? null;

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!rawId && me?.id) {
            router.replace(`/connections?user_id=${encodeURIComponent(me.id)}`, {scroll: false});
        }
    }, [rawId, me?.id, router]);

    const load = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/profile?user_id=${encodeURIComponent(id)}`, {cache: "no-store"});
            if (res.status === 404) {
                setProfile(null);
                setError("That person is not in the graph.");
                return;
            }
            if (!res.ok) {
                throw new Error(
                    res.status === 401
                        ? "Your session expired. Sign in again to continue."
                        : "Could not load this profile. The graph may be unreachable."
                );
            }
            setProfile(await res.json() as ProfileData);
        } catch (e) {
            setProfile(null);
            setError(e instanceof Error ? e.message : "Could not load this profile.");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void load();
    }, [load]);

    if (!id && !networkLoading) {
        return (
            <div>
                <ErrorState
                    title="No profile selected"
                    message="Open a person from your network or from discovery to view their profile."
                />
            </div>
        );
    }

    if (loading || networkLoading || !profile) {
        if (error) {
            return (
                <div>
                    <ErrorState
                        title="Profile unavailable"
                        message={error}
                        onRetry={() => void load()}
                    />
                </div>
            );
        }
        return (
            <div>
                <div className="gn-skeleton-page" role="status" aria-live="polite">
                    <span className="gn-sr">Loading profile…</span>
                    <div className="gn-skel" style={{height: 168, borderRadius: 14}}/>
                    <div className="gn-2col">
                        <div className="gn-skel" style={{height: 300, borderRadius: 14}}/>
                        <div className="gn-skel" style={{height: 220, borderRadius: 14}}/>
                    </div>
                </div>
            </div>
        );
    }

    const {person, mutual, connections} = profile;
    const isSelf = person.status === "self";
    const canSee = connections !== null;
    const connectionsValue = canSee ? String(connections.length) : "—";
    const connectionLabel = canSee ? "connections" : "connections hidden";
    const secondValue = isSelf ? counts.second + counts.third : person.mutual;
    const secondLabel = isSelf ? "within 2 steps" : "mutual";

    const meta = isSelf
        ? "This is you. Your network is everything below."
        : person.status === "connected"
            ? `1st degree connection · ${person.mutual > 0 ? plural(person.mutual, "mutual connection") : "no mutual connections"}`
            : person.degree === null
                ? "Not in your network yet."
                : `${degreePhrase(person.degree)} · ${person.mutual > 0 ? plural(person.mutual, "mutual connection") : "no mutual connections"}`;

    const connectionTitle = isSelf ? "Your connections" : `${firstName(person.name)}’s connections`;

    return (
        <div>
            <div className="gn-card gn-profile-hero">
                <div className="gn-profile-hero-main">
                    <AvatarRing
                        name={person.name}
                        degree={person.degree}
                        status={person.status}
                        size="2xl"
                    />
                    <div className="gn-profile-id">
                        <div className="gn-flex gn-ic gn-gap-10 gn-flex-wrap">
                            <h1 className="gn-h1" style={{fontSize: 26}}>{person.name}</h1>
                            <DegreeDot status={person.status} degree={person.degree}/>
                        </div>
                        <div className="gn-profile-meta">{meta}</div>
                        {!isSelf && (
                            <div className="gn-profile-actions">
                                <ConnectionActions person={person} onChanged={() => void load()} size="sm"/>
                            </div>
                        )}
                    </div>
                    <div className="gn-profile-stats">
                        <div>
                            <div className="gn-profile-stat-v">{connectionsValue}</div>
                            <div className="gn-profile-stat-l">{connectionLabel}</div>
                        </div>
                        <div>
                            <div className="gn-profile-stat-v">{secondValue}</div>
                            <div className="gn-profile-stat-l">{secondLabel}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={isSelf ? undefined : "gn-2col"} style={{marginTop: 14}}>
                <div className="gn-stack">
                    <section className="gn-card">
                        <div className="gn-card-h">
                            <span className="gn-card-title">{connectionTitle}</span>
                            <span className="gn-card-meta">{canSee ? connections.length : "hidden"}</span>
                        </div>
                        {!canSee ? (
                            <EmptyState
                                icon={<Lock size={20}/>}
                                title="Visible after you connect"
                                description={`A full connection list is only visible for yourself and your 1st degree connections.${person.status === "sent" ? " Your request is still pending." : ""}`}
                            />
                        ) : connections.length === 0 ? (
                            <EmptyState
                                compact
                                title="No connections yet"
                                description={isSelf ? "Find people to start building your network." : `${firstName(person.name)} has not connected with anyone yet.`}
                            />
                        ) : (
                            connections.map((p) => (
                                <PersonRow key={p.id} person={p} protectConnected onChanged={() => void load()}/>
                            ))
                        )}
                    </section>
                </div>

                {!isSelf && (
                    <div className="gn-stack">
                        <section className="gn-card">
                            <div className="gn-card-h">
                                <span className="gn-card-title">Mutual connections</span>
                                <span className="gn-card-meta">{mutual.length}</span>
                            </div>
                            {mutual.length > 0 ? mutual.map((p) => (
                                <PersonRow key={p.id} person={p} protectConnected onChanged={() => void load()}/>
                            )) : (
                                <EmptyState
                                    compact
                                    title="No mutual connections"
                                    description={`You and ${firstName(person.name)} do not share a connection yet.`}
                                />
                            )}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}
