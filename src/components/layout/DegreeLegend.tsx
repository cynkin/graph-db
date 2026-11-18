const DEGREES = [
    {tone: "k1", label: "1st"},
    {tone: "k2", label: "2nd"},
    {tone: "k3", label: "3rd"},
];

/**
 * Always visible on application pages. The dots carry the same emerald/amber/slate
 * encoding as the rings, so a colour alone is never the only carrier of meaning.
 */
export default function DegreeLegend() {
    return (
        <div
            className="gn-degree-key"
            role="note"
            aria-label="Degree colours: emerald is 1st degree, amber is 2nd degree, slate is 3rd degree"
        >
            <span className="gn-eyebrow">Degree key</span>
            {DEGREES.map((degree) => (
                <span className="gn-degree-key-item" key={degree.tone}>
                    <i className={`gn-degree-dot ${degree.tone}`} aria-hidden="true"/>
                    {degree.label}
                </span>
            ))}
        </div>
    );
}
