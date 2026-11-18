import Link from "next/link";
import BrandMark from "@/components/UI/BrandMark";
import Constellation from "@/components/Auth/Constellation";

export default function AuthFormWrapper({
    children,
    step,
}: {
    children: React.ReactNode;
    step?: 1 | 2 | 3;
}) {
    return (
        <div className="gn gn-auth" data-mode="app">
            <div className="gn-auth-art">
                <Link href="/" className="gn-auth-brand" style={{padding: 0}}>
                    <BrandMark size={28}/>
                    <span className="gn-wordmark" style={{fontSize: 17}}>GraphNet</span>
                </Link>

                <div className="gn-auth-art-mid">
                    <Constellation/>
                </div>

                <div className="gn-auth-claim">
                    <h2>Your network has a shape.</h2>
                </div>
            </div>

            <div className="gn-auth-panel">
                <div className="gn-auth-form">
                    <div className="gn-auth-brand gn-auth-brand-mobile">
                        <BrandMark size={24}/>
                        <span className="gn-wordmark" style={{fontSize: 15}}>GraphNet</span>
                    </div>

                    {step && (
                        <div className="gn-auth-step">
                            {[1, 2, 3].map((n) => (
                                <i key={n} className={n <= step ? "on" : ""}/>
                            ))}
                            <span>Step {step} of 3</span>
                        </div>
                    )}

                    {children}
                </div>
            </div>
        </div>
    );
}
