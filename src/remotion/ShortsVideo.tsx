import React from "react";
import { ShortsScene } from "@/types";

export interface ShortsVideoProps {
  title: string;
  scenes: ShortsScene[];
}

export const ShortsVideo: React.FC<ShortsVideoProps> = ({ title, scenes }) => {
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: "#090d16",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {(scenes || []).map((scene, idx) => (
        <div
          key={scene.id || idx}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Visual Background */}
          {scene.image_url ? (
            <img
              src={scene.image_url}
              alt={scene.visual_description || "Scene Visual"}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#a855f7",
                fontSize: 36,
                fontWeight: "bold",
              }}
            >
              {title} - Scene {idx + 1}
            </div>
          )}

          {/* Subtitle Overlay */}
          <div
            style={{
              position: "absolute",
              bottom: 120,
              left: 40,
              right: 40,
              backgroundColor: "rgba(0,0,0,0.75)",
              padding: "24px 32px",
              borderRadius: 24,
              textAlign: "center",
              border: "2px solid rgba(255,255,255,0.2)",
            }}
          >
            <p
              style={{
                color: "#ffffff",
                fontSize: 42,
                fontWeight: 800,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {scene.caption || scene.narration}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
