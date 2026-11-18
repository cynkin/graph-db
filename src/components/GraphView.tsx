'use client';
import {useEffect, useRef, useState} from "react";

export type GraphData = {
    nodes: {id: string; name: string}[];
    links: {source: string; target: string; type: "CONNECTED" | "REQUESTED"}[];
};

type Sim = {id: string; name: string; x: number; y: number; vx: number; vy: number; fixed: boolean};

const W = 900;
const H = 560;
const R = 18;

/** Small force-directed layout (repulsion + springs + centering) drawn in SVG. Drag nodes to move them. */
export default function GraphView({data}: {data: GraphData}) {
    const svgRef = useRef<SVGSVGElement>(null);
    const nodes = useRef<Map<string, Sim>>(new Map());
    const dragging = useRef<string | null>(null);
    const heat = useRef(1);
    const [, setFrame] = useState(0);

    // (Re)build the simulation when the data changes, keeping positions of nodes we already have.
    useEffect(() => {
        const old = nodes.current;
        const next = new Map<string, Sim>();
        data.nodes.forEach((n, i) => {
            const prev = old.get(n.id);
            const angle = (2 * Math.PI * i) / Math.max(data.nodes.length, 1);
            next.set(n.id, prev ? {...prev, name: n.name} : {
                id: n.id, name: n.name, fixed: false, vx: 0, vy: 0,
                x: W / 2 + Math.cos(angle) * 200, y: H / 2 + Math.sin(angle) * 200,
            });
        });
        nodes.current = next;
        heat.current = 1;
        setFrame((f) => f + 1); // draw right away, don't wait for the first animation frame
    }, [data]);

    // Animation loop.
    useEffect(() => {
        let raf = 0;
        const step = () => {
            const list = [...nodes.current.values()];
            if (heat.current > 0.01) {
                for (let i = 0; i < list.length; i++) {
                    for (let j = i + 1; j < list.length; j++) {
                        const a = list[i], b = list[j];
                        const dx = b.x - a.x || 0.01, dy = b.y - a.y || 0.01;
                        const d2 = Math.max(dx * dx + dy * dy, 100);
                        const f = Math.min(6000 / d2, 10);
                        const d = Math.sqrt(d2);
                        a.vx -= (dx / d) * f; a.vy -= (dy / d) * f;
                        b.vx += (dx / d) * f; b.vy += (dy / d) * f;
                    }
                }
                for (const l of data.links) {
                    const a = nodes.current.get(l.source), b = nodes.current.get(l.target);
                    if (!a || !b) continue;
                    const dx = b.x - a.x, dy = b.y - a.y;
                    const d = Math.sqrt(dx * dx + dy * dy) || 1;
                    const f = (d - 110) * 0.03;
                    a.vx += (dx / d) * f; a.vy += (dy / d) * f;
                    b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
                }
                for (const n of list) {
                    n.vx += (W / 2 - n.x) * 0.002;
                    n.vy += (H / 2 - n.y) * 0.002;
                    if (n.fixed) { n.vx = 0; n.vy = 0; continue; }
                    n.vx *= 0.85; n.vy *= 0.85;
                    n.x = Math.min(W - R, Math.max(R, n.x + n.vx * heat.current));
                    n.y = Math.min(H - R, Math.max(R, n.y + n.vy * heat.current));
                }
                heat.current *= 0.995;
                setFrame((f) => f + 1);
            }
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [data]);

    const toSvg = (e: React.PointerEvent) => {
        const ctm = svgRef.current!.getScreenCTM()!;
        return {x: (e.clientX - ctm.e) / ctm.a, y: (e.clientY - ctm.f) / ctm.d};
    };

    const onDown = (id: string) => (e: React.PointerEvent) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        dragging.current = id;
        nodes.current.get(id)!.fixed = true;
        heat.current = Math.max(heat.current, 0.5);
    };
    const onMove = (e: React.PointerEvent) => {
        if (!dragging.current) return;
        const n = nodes.current.get(dragging.current)!;
        const p = toSvg(e);
        n.x = Math.min(W - R, Math.max(R, p.x));
        n.y = Math.min(H - R, Math.max(R, p.y));
        heat.current = Math.max(heat.current, 0.5);
        setFrame((f) => f + 1);
    };
    const onUp = () => {
        if (dragging.current) nodes.current.get(dragging.current)!.fixed = false;
        dragging.current = null;
    };

    return (
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-600 rounded-2xl bg-white touch-none select-none"
             onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
            <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M0,0 L10,5 L0,10 z" fill="#9ca3af"/>
                </marker>
            </defs>
            {data.links.map((l, i) => {
                const a = nodes.current.get(l.source), b = nodes.current.get(l.target);
                if (!a || !b) return null;
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
                // Stop the line at the node's edge so arrows are visible.
                const x2 = b.x - (dx / d) * R, y2 = b.y - (dy / d) * R;
                return l.type === "CONNECTED"
                    ? <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#5423e7" strokeWidth={2}/>
                    : <line key={i} x1={a.x} y1={a.y} x2={x2} y2={y2} stroke="#9ca3af" strokeWidth={1.5}
                            strokeDasharray="5 4" markerEnd="url(#arrow)"/>;
            })}
            {[...nodes.current.values()].map((n) => (
                <g key={n.id} transform={`translate(${n.x},${n.y})`} onPointerDown={onDown(n.id)} className="cursor-grab">
                    <circle r={R} fill="#1568e3" stroke="white" strokeWidth={2}/>
                    <text textAnchor="middle" dy="0.35em" fontSize={12} fill="white" fontWeight="bold">
                        {n.name.slice(0, 2).toUpperCase()}
                    </text>
                </g>
            ))}
            {/* Names go in their own layer, drawn last, with a white halo, so edges never cover them. */}
            {[...nodes.current.values()].map((n) => (
                <text key={`label-${n.id}`} x={n.x} y={n.y + R + 15} textAnchor="middle" fontSize={12} fontWeight={600}
                      fill="#171717" stroke="white" strokeWidth={5} strokeLinejoin="round" paintOrder="stroke"
                      className="pointer-events-none">
                    {n.name}
                </text>
            ))}
        </svg>
    );
}
