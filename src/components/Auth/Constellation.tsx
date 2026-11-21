const CX = 260;
const CY = 260;

const RINGS = [
    {r: 74, n: 8, size: 4.4},
    {r: 124, n: 11, size: 3.1},
    {r: 172, n: 8, size: 2.7},
];

/** A deterministic three-orbit constellation: the product's story in one graphic. */
export default function Constellation({animated = true}: {animated?: boolean}) {
    const positions = RINGS.map((ring, ringIndex) =>
        Array.from({length: ring.n}, (_, i) => {
            const angle = -Math.PI / 2 + (i / ring.n) * Math.PI * 2 + ringIndex * 0.34;
            return {
                x: CX + Math.cos(angle) * ring.r,
                y: CY + Math.sin(angle) * ring.r,
            };
        })
    );

    return (
        <svg className="gn-const" viewBox="0 0 520 520" fill="none" aria-hidden="true" focusable="false">
            <circle className="const-orbit r1" cx={CX} cy={CY} r={74}/>
            <circle className="const-orbit r2" cx={CX} cy={CY} r={124}/>
            <circle className="const-orbit r3" cx={CX} cy={CY} r={172}/>

            {positions[0].map((p, i) => (
                <line
                    key={`spoke-${i}`}
                    className="const-spoke"
                    x1={CX}
                    y1={CY}
                    x2={p.x.toFixed(1)}
                    y2={p.y.toFixed(1)}
                />
            ))}

            {[0, 1].map((ringIndex) => {
                const from = positions[ringIndex];
                const to = positions[ringIndex + 1];
                return from.flatMap((p, i) => {
                    const j = Math.round((i / from.length) * to.length) % to.length;
                    return [j, (j + 1) % to.length].map((k) => {
                        const q = to[k];
                        return (
                            <line
                                key={`tie-${ringIndex}-${i}-${k}`}
                                className={ringIndex === 0 ? "const-tie-1" : "const-tie-2"}
                                x1={p.x.toFixed(1)}
                                y1={p.y.toFixed(1)}
                                x2={q.x.toFixed(1)}
                                y2={q.y.toFixed(1)}
                            />
                        );
                    });
                });
            })}

            {positions.map((ring, ringIndex) =>
                ring.map((p, i) => (
                    <circle
                        key={`node-${ringIndex}-${i}`}
                        className={`const-node r${ringIndex + 1}`}
                        cx={p.x.toFixed(1)}
                        cy={p.y.toFixed(1)}
                        r={RINGS[ringIndex].size}
                        style={animated ? {
                            animation: `gn-pulse 6s ease-in-out ${(ringIndex * 0.4 + i * 0.13).toFixed(2)}s infinite`,
                        } : undefined}
                    />
                ))
            )}

            <circle className="const-center-halo" cx={CX} cy={CY} r={18}/>
            <circle className="const-center" cx={CX} cy={CY} r={8}/>
        </svg>
    );
}
