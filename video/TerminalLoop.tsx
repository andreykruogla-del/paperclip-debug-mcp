import React from "react";
import {AbsoluteFill, interpolate, useCurrentFrame} from "remotion";

const loopLines = [
  "$ paperclipDebug.prioritize_incidents",
  "topSignals: auth_failure, heartbeat_drift",
  "$ paperclipDebug.trace_handoff --run-id 4578b76c",
  "linked run->issue chain restored",
  "$ paperclipDebug.build_incident_packet --issue-id TIA-184",
  "evidence packet ready",
];

const visibleChars = (text: string, frame: number, at: number): string => {
  const count = Math.max(0, Math.floor((frame - at) * 1.2));
  return text.slice(0, Math.min(text.length, count));
};

export const TerminalLoop: React.FC = () => {
  const frame = useCurrentFrame();

  const showFrame = frame % 240;
  const starts = [8, 34, 64, 92, 126, 154];
  const cardPulse = 0.45 + 0.55 * Math.sin(showFrame * 0.08);
  const fade = interpolate(showFrame, [0, 12, 220, 239], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity: fade,
        background:
          "radial-gradient(circle at 50% 20%, #1A2C3B 0%, #0E1824 55%, #090E15 100%)",
        color: "#E7EEF6",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{padding: "24px 30px 12px"}}>
        <div style={{fontSize: 35, fontWeight: 800}}>Unified Incident Flow</div>
        <div style={{fontSize: 18, marginTop: 4, color: "#A8BCCF"}}>
          Paperclip Debug MCP terminal snapshot
        </div>
      </div>

      <div
        style={{
          margin: "8px 30px 0",
          borderRadius: 14,
          border: "1px solid rgba(122,246,255,0.38)",
          background: "rgba(8,14,22,0.84)",
          boxShadow: `0 0 24px rgba(122,246,255,${0.12 + cardPulse * 0.18})`,
          padding: "18px 16px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 18,
          lineHeight: 1.5,
          minHeight: 315,
        }}
      >
        {loopLines.map((line, index) => {
          const text = visibleChars(line, showFrame, starts[index]);
          const isCmd = line.startsWith("$");
          return (
            <div
              key={`${line}-${index}`}
              style={{
                color: isCmd ? "#82F6FF" : "#CFDBE7",
                marginBottom: 5,
              }}
            >
              {text}
              {showFrame >= starts[index] && showFrame < starts[index] + line.length * 1.2 ? (
                <span style={{color: "#FFBB86"}}>_</span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 30,
          right: 30,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 17,
          color: "#B7C8D9",
        }}
      >
        <div>faster triage, clearer handoff, fewer loops</div>
        <div style={{color: "#84F6FF", fontWeight: 700}}>early testers open</div>
      </div>
    </AbsoluteFill>
  );
};

