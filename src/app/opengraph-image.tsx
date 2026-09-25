import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

/** Social preview card (Open Graph + Twitter) — ÖRZA's dark hero with the energy orb. */
export const alt = "ÖRZA — AI-powered wellness that evolves with you";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#07090C",
          backgroundImage: "linear-gradient(160deg, #0B0F14 0%, #07090C 60%)",
          color: "#F7F4EF",
          padding: "72px 80px",
        }}
      >
        {/* Energy orb */}
        <div
          style={{
            position: "absolute",
            right: -240,
            top: -90,
            width: 840,
            height: 840,
            display: "flex",
            backgroundImage:
              "radial-gradient(circle at 50% 50%, #FFE7C8 0%, rgba(255,180,84,0.9) 13%, rgba(255,122,106,0.55) 27%, rgba(255,95,162,0.22) 39%, rgba(7,9,12,0) 50%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 9999,
                display: "flex",
                backgroundImage: "linear-gradient(135deg, #FFB454 0%, #FF7A6A 50%, #FF5FA2 100%)",
              }}
            />
            <div style={{ fontSize: 44, letterSpacing: "0.04em", display: "flex" }}>{SITE.name}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
            <div style={{ fontSize: 20, letterSpacing: "0.22em", color: "rgba(247,244,239,0.72)", display: "flex" }}>
              INDIA-FIRST AI WELLNESS
            </div>
            <div style={{ fontSize: 66, lineHeight: 1.06, marginTop: 20, letterSpacing: "-0.02em", display: "flex" }}>{SITE.tagline}</div>
            <div style={{ fontSize: 26, lineHeight: 1.4, marginTop: 26, color: "rgba(247,244,239,0.72)", display: "flex" }}>
              Snap your meals, chat naturally, get instant nutritional insights.
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
