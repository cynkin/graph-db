"use client";

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from "react";
import type {GraphLink, GraphNode, NodeStats} from "@/components/people/types";
import {initials} from "@/components/people/helpers";

const WORLD_W = 1200;
const WORLD_H = 760;
const MIN_K = 0.28;
const MAX_K = 2.6;

type Point = {x: number; y: number};
type Positions = Record<string, Point>;

export type GraphHandle = {
    zoomIn: () => void;
    zoomOut: () => void;
    fit: () => void;
    focusNode: (id: string) => void;
};

type Props = {
    nodes: GraphNode[];
    links: GraphLink[];
    stats: Record<string, NodeStats>;
    hidden: {CONNECTED: boolean; REQUESTED: boolean};
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    query: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clampK = (k: number) => clamp(k, MIN_K, MAX_K);

/** Spread a finished layout across the world, so sparse graphs do not collapse into a corner. */
function normalizeLayout(pos: Positions, nodes: GraphNode[]): Positions {
    if (nodes.length < 2) {
        const only = nodes[0] ? pos[nodes[0].id] : null;
        return only ? {[nodes[0].id]: {x: WORLD_W / 2, y: WORLD_H / 2}} : pos;
    }

    const points = nodes.map((n) => pos[n.id]).filter(Boolean);
    if (points.length === 0) return pos;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }

    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);
    const scale = clamp(Math.min((WORLD_W - 180) / width, (WORLD_H - 140) / height), 0.7, 2.4);
    const offsetX = (WORLD_W - width * scale) / 2 - minX * scale;
    const offsetY = (WORLD_H - height * scale) / 2 - minY * scale;

    const next: Positions = {};
    for (const node of nodes) {
        const p = pos[node.id];
        if (!p) continue;
        next[node.id] = {x: p.x * scale + offsetX, y: p.y * scale + offsetY};
    }
    return next;
}

/** Deterministic force layout in a fixed world, so dragging survives viewport resizes. */
function computeLayout(nodes: GraphNode[], links: GraphLink[]): Positions {
    const n = nodes.length;
    if (n === 0) return {};

    const pos: Positions = {};

    // Very large graphs: a radial arrangement avoids an O(n²) layout freeze.
    if (n > 400) {
        nodes.forEach((node, i) => {
            const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
            const radius = Math.min(WORLD_W, WORLD_H) * 0.4 * (0.4 + 0.6 * Math.sqrt((i + 1) / n));
            pos[node.id] = {
                x: WORLD_W / 2 + Math.cos(angle) * radius * 1.25,
                y: WORLD_H / 2 + Math.sin(angle) * radius,
            };
        });
        return normalizeLayout(pos, nodes);
    }

    const velocity: Record<string, Point> = {};
    nodes.forEach((node, i) => {
        const angle = i * 2.39996;
        const radius = Math.sqrt(i / Math.max(n - 1, 1)) * Math.min(WORLD_W, WORLD_H) * 0.4;
        pos[node.id] = {
            x: WORLD_W / 2 + Math.cos(angle) * radius,
            y: WORLD_H / 2 + Math.sin(angle) * radius,
        };
        velocity[node.id] = {x: 0, y: 0};
    });

    const iterations = n > 150 ? 110 : 420;
    const ids = nodes.map((node) => node.id);

    for (let step = 0; step < iterations; step++) {
        const heat = 1 - step / iterations;

        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const a = pos[ids[i]];
                const b = pos[ids[j]];
                const dx = b.x - a.x || 0.01;
                const dy = b.y - a.y || 0.01;
                const d2 = Math.max(dx * dx + dy * dy, 60);
                const force = Math.min(9000 / d2, 9);
                const d = Math.sqrt(d2);
                velocity[ids[i]].x -= (dx / d) * force;
                velocity[ids[i]].y -= (dy / d) * force;
                velocity[ids[j]].x += (dx / d) * force;
                velocity[ids[j]].y += (dy / d) * force;
            }
        }

        for (const link of links) {
            const a = pos[link.source];
            const b = pos[link.target];
            if (!a || !b) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const target = link.type === "REQUESTED" ? 130 : 96;
            const force = (d - target) * 0.028;
            velocity[link.source].x += (dx / d) * force;
            velocity[link.source].y += (dy / d) * force;
            velocity[link.target].x -= (dx / d) * force;
            velocity[link.target].y -= (dy / d) * force;
        }

        for (const id of ids) {
            const v = velocity[id];
            const p = pos[id];
            v.x += (WORLD_W / 2 - p.x) * 0.0036;
            v.y += (WORLD_H / 2 - p.y) * 0.0036;
            v.x *= 0.86;
            v.y *= 0.86;
            p.x = clamp(p.x + v.x * heat, 80, WORLD_W - 80);
            p.y = clamp(p.y + v.y * heat, 48, WORLD_H - 48);
        }
    }

    return normalizeLayout(pos, nodes);
}

const GraphCanvas = forwardRef<GraphHandle, Props>(function GraphCanvas(
    {nodes, links, stats, hidden, selectedId, onSelect, query},
    ref
) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [size, setSize] = useState({w: 0, h: 0});
    const [positions, setPositions] = useState<Positions>(() => computeLayout(nodes, links));
    const [view, setView] = useState({x: 0, y: 0, k: 1});
    const [interacting, setInteracting] = useState(false);

    const viewRef = useRef(view);
    const sizeRef = useRef(size);
    const posRef = useRef(positions);
    const selectedRef = useRef(selectedId);
    viewRef.current = view;
    sizeRef.current = size;
    posRef.current = positions;
    selectedRef.current = selectedId;

    const pointers = useRef(new Map<number, Point>());
    const panRef = useRef<{startX: number; startY: number; originX: number; originY: number; moved: boolean} | null>(null);
    const dragRef = useRef<{
        id: string;
        startX: number;
        startY: number;
        world: Point;
        moved: boolean;
    } | null>(null);
    const pinchRef = useRef<{
        distance: number;
        mid: Point;
        view: {x: number; y: number; k: number};
    } | null>(null);

    const signature = useMemo(
        () => `${nodes.map((n) => n.id).join("|")}#${links.map((l) => `${l.source}>${l.target}:${l.type}`).join("|")}`,
        [nodes, links]
    );

    // Resize the canvas with its container; the world stays fixed.
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setSize({w: rect.width, h: rect.height});

        const observer = new ResizeObserver((entries) => {
            const box = entries[0]?.contentRect;
            if (!box) return;
            setSize({w: box.width, h: box.height});
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Rebuild the layout only when the graph itself changes.
    useEffect(() => {
        setPositions(computeLayout(nodes, links));
        pinchRef.current = null;
        dragRef.current = null;
        panRef.current = null;
        pointers.current.clear();
        setInteracting(false);
    }, [nodes, links]);

    const zoomAtPoint = useCallback((mx: number, my: number, factor: number) => {
        setView((current) => {
            const k = clampK(current.k * factor);
            const ratio = k / current.k;
            return {
                k,
                x: mx - (mx - current.x) * ratio,
                y: my - (my - current.y) * ratio,
            };
        });
    }, []);

    const fitWithMin = useCallback((minK = 0) => {
        const points = Object.values(posRef.current);
        const {w, h} = sizeRef.current;
        if (points.length === 0 || w === 0 || h === 0) return;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const p of points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }

        const pad = 56;
        const width = Math.max(maxX - minX, 1);
        const height = Math.max(maxY - minY, 1);
        const natural = Math.min((w - pad * 2) / width, (h - pad * 2) / height);
        const k = clampK(Math.max(natural, minK));

        setView({
            k,
            x: w / 2 - ((minX + maxX) / 2) * k,
            y: h / 2 - ((minY + maxY) / 2) * k,
        });
    }, []);

    const fit = useCallback(() => fitWithMin(0), [fitWithMin]);

    const zoomIn = useCallback(() => {
        const {w, h} = sizeRef.current;
        zoomAtPoint(w / 2, h / 2, 1.22);
    }, [zoomAtPoint]);

    const zoomOut = useCallback(() => {
        const {w, h} = sizeRef.current;
        zoomAtPoint(w / 2, h / 2, 1 / 1.22);
    }, [zoomAtPoint]);

    const focusNode = useCallback((id: string) => {
        const point = posRef.current[id];
        const {w, h} = sizeRef.current;
        if (!point || w === 0) return;
        const inset = selectedRef.current ? 280 : 0;
        setView((current) => {
            const k = Math.max(current.k, 0.95);
            return {
                k,
                x: (w - inset) / 2 - point.x * k,
                y: h / 2 - point.y * k,
            };
        });
    }, []);

    useImperativeHandle(ref, () => ({zoomIn, zoomOut, fit, focusNode}), [zoomIn, zoomOut, fit, focusNode]);

    // Fit on first paint, on resize, and when the dataset changes; never on a node drag.
    const fittedFor = useRef("");
    useEffect(() => {
        if (size.w === 0 || size.h === 0 || Object.keys(positions).length === 0) return;
        const key = `${Math.round(size.w)}x${Math.round(size.h)}:${signature}`;
        if (fittedFor.current === key) return;
        fittedFor.current = key;
        // On narrow screens, readability beats showing every node at an unreadable scale.
        // The Fit control still returns to the complete overview.
        fitWithMin(size.w < 980 ? 0.72 : 0);
    }, [size.w, size.h, positions, signature, fitWithMin]);

    // Native wheel listener so preventDefault works reliably.
    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            zoomAtPoint(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
        };
        el.addEventListener("wheel", onWheel, {passive: false});
        return () => el.removeEventListener("wheel", onWheel);
    }, [zoomAtPoint]);

    useEffect(() => {
        const map = pointers.current;
        return () => {
            map.clear();
        };
    }, []);

    const pointerDistance = () => {
        const values = [...pointers.current.values()];
        if (values.length < 2) return null;
        const [a, b] = values;
        return {
            distance: Math.hypot(b.x - a.x, b.y - a.y),
            mid: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2},
        };
    };

    const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        pointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
        e.currentTarget.setPointerCapture(e.pointerId);

        if (pointers.current.size === 2) {
            const pinch = pointerDistance();
            if (pinch) {
                pinchRef.current = {...pinch, view: {...viewRef.current}};
                panRef.current = null;
                dragRef.current = null;
                setInteracting(true);
            }
            return;
        }

        const nodeEl = (e.target as Element).closest?.("[data-node-id]");
        if (nodeEl) {
            const id = nodeEl.getAttribute("data-node-id");
            const world = id ? posRef.current[id] : null;
            if (id && world) {
                dragRef.current = {
                    id,
                    startX: e.clientX,
                    startY: e.clientY,
                    world: {...world},
                    moved: false,
                };
                setInteracting(true);
                return;
            }
        }

        panRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            originX: viewRef.current.x,
            originY: viewRef.current.y,
            moved: false,
        };
        setInteracting(true);
    };

    const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});

        if (pointers.current.size >= 2 && pinchRef.current) {
            const pinch = pointerDistance();
            if (!pinch || pinch.distance === 0) return;
            const base = pinchRef.current;
            const k = clampK(base.view.k * (pinch.distance / Math.max(base.distance, 1)));
            const worldX = (base.mid.x - base.view.x) / base.view.k;
            const worldY = (base.mid.y - base.view.y) / base.view.k;
            setView({
                k,
                x: pinch.mid.x - worldX * k,
                y: pinch.mid.y - worldY * k,
            });
            return;
        }

        const drag = dragRef.current;
        if (drag) {
            const dx = (e.clientX - drag.startX) / viewRef.current.k;
            const dy = (e.clientY - drag.startY) / viewRef.current.k;
            if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 3) drag.moved = true;
            if (!drag.moved) return;
            setPositions((current) => ({
                ...current,
                [drag.id]: {
                    x: clamp(drag.world.x + dx, 32, WORLD_W - 32),
                    y: clamp(drag.world.y + dy, 32, WORLD_H - 32),
                },
            }));
            return;
        }

        const pan = panRef.current;
        if (pan) {
            const dx = e.clientX - pan.startX;
            const dy = e.clientY - pan.startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pan.moved = true;
            setView((current) => ({
                ...current,
                x: pan.originX + dx,
                y: pan.originY + dy,
            }));
        }
    };

    const finishPointer = (e: React.PointerEvent<SVGSVGElement>, cancelled: boolean) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinchRef.current = null;

        const drag = dragRef.current;
        if (drag) {
            dragRef.current = null;
            if (!cancelled && !drag.moved) onSelect(drag.id);
        }

        const pan = panRef.current;
        if (pan) {
            panRef.current = null;
            if (!cancelled && !pan.moved) onSelect(null);
        }

        if (pointers.current.size === 0) setInteracting(false);
    };

    const statsOf = (id: string): NodeStats => stats[id] ?? {connections: 0, incoming: 0, outgoing: 0};
    const radiusOf = (id: string) => 13 + Math.min(statsOf(id).connections, 8);

    const selectedNeighbours = useMemo(() => {
        const set = new Set<string>();
        if (!selectedId) return set;
        set.add(selectedId);
        for (const link of links) {
            if (link.source === selectedId) set.add(link.target);
            if (link.target === selectedId) set.add(link.source);
        }
        return set;
    }, [selectedId, links]);

    const normalizedQuery = query.trim().toLowerCase();
    const matches = useMemo(() => {
        if (!normalizedQuery) return new Set<string>();
        return new Set(nodes.filter((n) => n.name.toLowerCase().includes(normalizedQuery)).map((n) => n.id));
    }, [nodes, normalizedQuery]);

    const visibleLinks = links.filter((l) => !hidden[l.type] && positions[l.source] && positions[l.target]);

    return (
        <div className="gn-graph-wrap" ref={wrapRef}>
            <svg
                ref={svgRef}
                className={`gn-graph${interacting ? " is-dragging" : ""}`}
                width="100%"
                height="100%"
                role="img"
                aria-label="Neo4j relationship graph. Drag nodes to rearrange, drag the background to pan, scroll to zoom, and select a node to inspect it."
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => finishPointer(e, false)}
                onPointerCancel={(e) => finishPointer(e, true)}
            >
                <defs>
                    <marker
                        id="g-arrow"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                    >
                        <path className="g-arrow-head" d="M0,0 L10,5 L0,10 z"/>
                    </marker>
                </defs>

                <rect className="g-bg" x="0" y="0" width="100%" height="100%"/>

                <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
                    {visibleLinks.map((link, index) => {
                        const a = positions[link.source];
                        const b = positions[link.target];
                        const ra = radiusOf(link.source);
                        const rb = radiusOf(link.target);
                        const dx = b.x - a.x;
                        const dy = b.y - a.y;
                        const d = Math.sqrt(dx * dx + dy * dy) || 1;
                        const x1 = a.x + (dx / d) * ra;
                        const y1 = a.y + (dy / d) * ra;
                        const x2 = b.x - (dx / d) * (rb + 3);
                        const y2 = b.y - (dy / d) * (rb + 3);

                        let cls = `g-edge${link.type === "REQUESTED" ? " req" : ""}`;
                        if (selectedId) {
                            cls += link.source === selectedId || link.target === selectedId ? " is-lit" : " is-dim";
                        }

                        return (
                            <line
                                key={`${link.source}-${link.target}-${link.type}-${index}`}
                                className={cls}
                                x1={x1.toFixed(1)}
                                y1={y1.toFixed(1)}
                                x2={x2.toFixed(1)}
                                y2={y2.toFixed(1)}
                                markerEnd={link.type === "REQUESTED" ? "url(#g-arrow)" : undefined}
                            />
                        );
                    })}

                    {nodes.map((node) => {
                        const p = positions[node.id];
                        if (!p) return null;
                        const r = radiusOf(node.id);
                        const isSelected = selectedId === node.id;
                        const isMatch = matches.has(node.id);

                        let cls = "g-node";
                        if (isSelected) cls += " is-sel";
                        else if (selectedId && !selectedNeighbours.has(node.id)) cls += " is-dim";
                        else if (!selectedId && normalizedQuery && !isMatch) cls += " is-dim";
                        if (isMatch) cls += " is-match";

                        const s = statsOf(node.id);
                        return (
                            <g
                                key={node.id}
                                className={cls}
                                data-node-id={node.id}
                                transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
                                role="button"
                                tabIndex={0}
                                aria-label={`${node.name}: ${s.connections} connections, ${s.incoming} requests in, ${s.outgoing} requests out`}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onSelect(node.id);
                                    }
                                }}
                            >
                                <title>{`${node.name} · ${s.connections} connections`}</title>
                                <circle className="n-body" r={r.toFixed(1)}/>
                                <text className="n-ini" dy="3">{initials(node.name)}</text>
                                <text className="n-name" y={(r + 12).toFixed(1)}>{node.name}</text>
                            </g>
                        );
                    })}
                </g>
            </svg>

            <div className="gn-graph-tools">
                <button type="button" className="gn-btn gn-btn-ghost gn-btn-xs" onClick={fit}>
                    <span style={{display: "inline-flex", transform: "scale(0.9)"}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>
                        </svg>
                    </span>
                    Fit
                </button>
                <span style={{width: 1, height: 16, background: "var(--border)"}}/>
                <span className="gn-tiny gn-dim gn-mono gn-zoom">{Math.round(view.k * 100)}%</span>
                <span style={{width: 1, height: 16, background: "var(--border)"}}/>
                <span className="gn-tiny gn-dim" style={{paddingRight: 6}}>Drag nodes · click to inspect</span>
            </div>

            <div className="gn-graph-legend">
                <div className="lg"><i/>CONNECTED</div>
                <div className="lg"><i className="req"/>REQUESTED</div>
            </div>
        </div>
    );
});

export default GraphCanvas;
