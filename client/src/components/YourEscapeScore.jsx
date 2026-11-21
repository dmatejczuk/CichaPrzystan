
import React, { useMemo } from "react";
import { createPortal } from "react-dom";

function seededRandom(seed) {
    let hash = 2166136261;

    for (let i = 0; i < String(seed).length; i++) {
        hash ^= String(seed).charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    hash += hash << 13;
    hash ^= hash >>> 7;
    hash += hash << 3;
    hash ^= hash >>> 17;
    hash += hash << 5;

    return (hash >>> 0) / 4294967296;
}

export default function YourEscapeScore({
    placeId,
    distanceKm = 0,
    visible = true,
}) {
    const score = useMemo(() => {
        if (!placeId) return null;

        const distance = Math.min(
            10,
            Math.max(0, Number(distanceKm) || 0)
        );

        const random = seededRandom(placeId);

        return Math.min(
            100,
            Math.round(50 + distance + 40 * random)
        );
    }, [placeId, distanceKm]);

    // Hide badge when no accommodation is selected
    if (!visible || !placeId || score === null) return null;

    return createPortal(
        <div
            role="status"
            aria-label={`Your Escape Score: ${score} out of 100`}
            style={{
                position: "fixed",
                top: "20px",
                right: "20px",
                left: "auto",
                bottom: "auto",
                width: "min(310px, calc(100vw - 40px))",
                zIndex: 2147483647,
                boxSizing: "border-box",
                borderRadius: "18px",
                overflow: "hidden",
                fontFamily: "inherit",
                color: "#ffffff",
                background: "#173D32",
                boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
                animation: "escapeScoreAppear 0.35s ease-out",
            }}
        >
            <style>
                {`
          @keyframes escapeScoreAppear {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
            </style>

            {/* Header */}
            <div style={{ padding: "18px 20px 16px" }}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "14px",
                    }}
                >
                    <span
                        style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            letterSpacing: "2px",
                            color: "#C2E4D2",
                        }}
                    >
                        YOUR ESCAPE SCORE
                    </span>
                    <span style={{ fontSize: "20px" }}>✦</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                        style={{
                            fontSize: "48px",
                            fontWeight: 800,
                            letterSpacing: "-2px",
                            lineHeight: 1,
                        }}
                    >
                        {score}
                    </span>
                    <span
                        style={{
                            fontSize: "17px",
                            color: "#A8C9B8",
                            fontWeight: 500,
                        }}
                    >
                        /100
                    </span>
                </div>

                <div
                    style={{
                        fontSize: "14px",
                        color: "#C8DFD1",
                        marginTop: "7px",
                    }}
                >
                    Poza cywilizacją
                </div>

                <div style={{ fontSize: "20px", marginTop: "10px" }}>
                    🌲 🏔️ 🌌
                </div>

                <div
                    style={{
                        height: "8px",
                        background: "#416858",
                        borderRadius: "20px",
                        marginTop: "15px",
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            height: "100%",
                            width: `${score}%`,
                            background: "#B8E0C6",
                            borderRadius: "20px",
                            transition: "width 0.6s ease",
                        }}
                    />
                </div>

                <p
                    style={{
                        fontSize: "12px",
                        color: "#D3E8DB",
                        margin: "12px 0 0",
                    }}
                >
                    Idealne miejsce na cyfrowy detoks.
                </p>
            </div>

            {/* Details */}
            <div
                style={{
                    background: "#ffffff",
                    color: "#263B32",
                    padding: "15px 20px",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                    }}
                >
                    <span style={{ fontSize: "13px", color: "#718078" }}>
                        📡 Dostępność sieci
                    </span>
                    <strong style={{ fontSize: "13px" }}>Minimalna</strong>
                </div>

                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: "12px",
                        fontSize: "13px",
                        gap: "10px",
                    }}
                >
                    <span style={{ color: "#718078" }}>
                        📍 Odległość od zasięgu
                    </span>
                    <strong>
                        {Math.max(0, Number(distanceKm) || 0)} km
                    </strong>
                </div>
            </div>
        </div>,
    document.body
  );
}
