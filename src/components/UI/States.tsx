import type {ReactNode} from "react";
import {AlertTriangle} from "lucide-react";

export function EmptyState({
    icon,
    title,
    description,
    action,
    compact = false,
}: {
    icon?: ReactNode;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    compact?: boolean;
}) {
    return (
        <div className="gn-empty" style={compact ? {padding: "26px 20px"} : undefined}>
            {icon && <div className="gn-empty-ico">{icon}</div>}
            <div className="gn-empty-t">{title}</div>
            {description && <div className="gn-empty-d">{description}</div>}
            {action}
        </div>
    );
}

export function ErrorState({
    title = "Could not load this view",
    message,
    onRetry,
}: {
    title?: string;
    message: string;
    onRetry?: () => void;
}) {
    return (
        <div className="gn-card gn-page-state">
            <div className="gn-empty">
                <div className="gn-empty-ico is-danger"><AlertTriangle size={20}/></div>
                <div className="gn-empty-t">{title}</div>
                <div className="gn-empty-d">{message}</div>
                {onRetry && (
                    <button type="button" className="gn-btn gn-btn-secondary gn-btn-sm" onClick={onRetry}>
                        Try again
                    </button>
                )}
            </div>
        </div>
    );
}

export function PageLoading({label = "Loading your network…"}: {label?: string}) {
    return (
        <div className="gn-skeleton-page" role="status" aria-live="polite">
            <span className="gn-sr">{label}</span>
            <div className="gn-skel" style={{height: 34, width: "44%"}}/>
            <div className="gn-skel" style={{height: 14, width: "62%"}}/>
            <div className="gn-stats" style={{marginTop: 8}}>
                {[0, 1, 2, 3].map((i) => (
                    <div className="gn-stat" key={i}>
                        <div className="gn-skel" style={{height: 30, width: "42%"}}/>
                        <div className="gn-skel" style={{height: 11, width: "58%", marginTop: 10}}/>
                    </div>
                ))}
            </div>
            <div className="gn-2col" style={{marginTop: 14}}>
                <div className="gn-skel" style={{height: 320, borderRadius: 14}}/>
                <div className="gn-skel" style={{height: 320, borderRadius: 14}}/>
            </div>
        </div>
    );
}
