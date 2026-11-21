type Props = {
    size?: number;
    className?: string;
};

/** The GraphNet mark: three connected nodes and a faint fourth, drawn from the graph model. */
export default function BrandMark({size = 26, className = ""}: Props) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 26 26"
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M6.4 18.6 12.6 6.2M13.4 6.2h6.2M19.6 6.6v11.8M6.8 19.2h6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
            />
            <circle cx="12.6" cy="6.2" r="2.2" fill="currentColor"/>
            <circle cx="6.4" cy="18.8" r="2.2" fill="currentColor"/>
            <circle cx="19.6" cy="18.6" r="2.2" fill="currentColor"/>
            <circle cx="13" cy="19" r="1.5" fill="currentColor" opacity=".5"/>
        </svg>
    );
}
