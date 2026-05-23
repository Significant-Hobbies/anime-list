import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 600, color: "#fafafa" }}>
          {SITE_NAME}
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 32,
            color: "#a1a1aa",
            maxWidth: 880,
            textAlign: "center",
          }}
        >
          {SITE_TAGLINE}
        </div>
        <div style={{ marginTop: 36, display: "flex", gap: 12 }}>
          {["Anime", "Manga", "Watchlist"].map((tag) => (
            <div
              key={tag}
              style={{
                padding: "8px 20px",
                borderRadius: 999,
                border: "1px solid #3f3f46",
                background: "#18181b",
                color: "#d4d4d8",
                fontSize: 22,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
