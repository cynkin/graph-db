"use client";

import {Crosshair, Route, X} from "lucide-react";
import type {GraphNode, NodeStats} from "@/components/people/types";
import {AvatarRing} from "@/components/UI/Avatar";

export default function GraphDetailPanel({
    node,
    stats,
    onClear,
    onFocus,
}: {
    node: GraphNode | null;
    stats: NodeStats | null;
    onClear: () => void;
    onFocus: () => void;
}) {
    if (!node || !stats) {
        return (
            <div className="gn-detail">
                <div className="gn-detail-b" style={{padding: 14}}>
                    <div className="gn-flex gn-ic gn-gap-8" style={{color: "var(--text-tertiary)"}}>
                        <Route size={15}/>
                        <span style={{fontSize: 12}}>Select a node</span>
                    </div>
                    <p className="gn-tiny gn-dim" style={{marginTop: 7, lineHeight: 1.55}}>
                        Click any node to read its id, connection count and pending requests. Drag to rearrange
                        the layout, scroll to zoom.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="gn-detail">
            <div className="gn-detail-h">
                <AvatarRing name={node.name} degree={null} status="none" size="md"/>
                <div style={{minWidth: 0}}>
                    <div style={{fontSize: 13, fontWeight: 650}}>{node.name}</div>
                    <div className="gn-mono gn-dim" style={{fontSize: 10}}>:User</div>
                </div>
                <button
                    type="button"
                    className="gn-iconbtn"
                    style={{marginLeft: "auto", width: 24, height: 24}}
                    onClick={onClear}
                    aria-label="Clear selection"
                >
                    <X size={13}/>
                </button>
            </div>
            <div className="gn-detail-b">
                <dl style={{margin: 0}}>
                    <div className="gn-kv">
                        <dt>node id</dt>
                        <dd style={{fontSize: 10.5}} title={node.id}>{node.id}</dd>
                    </div>
                    <div className="gn-kv"><dt>connections</dt><dd>{stats.connections}</dd></div>
                    <div className="gn-kv"><dt>requests in</dt><dd>{stats.incoming}</dd></div>
                    <div className="gn-kv"><dt>requests out</dt><dd>{stats.outgoing}</dd></div>
                </dl>
                <button
                    type="button"
                    className="gn-btn gn-btn-secondary gn-btn-sm gn-btn-block"
                    style={{marginTop: 11}}
                    onClick={onFocus}
                >
                    <Crosshair size={13}/>Centre on node
                </button>
            </div>
        </div>
    );
}
