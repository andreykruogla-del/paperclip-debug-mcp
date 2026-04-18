import React from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from "remotion";

type TerminalLine = {
  at: number;
  text: string;
  tone?: "cmd" | "output" | "warn" | "good";
};

const beforeLines: TerminalLine[] = [
  {at: 0, text: "$ tail -n 300 /var/log/paperclip/server.log", tone: "cmd"},
  {at: 22, text: "searching for issue TIA-184 context...", tone: "output"},
  {at: 45, text: "$ paperclipDebug.list_issues --status open", tone: "cmd"},
  {at: 70, text: "Issue found, run linkage unclear", tone: "warn"},
  {at: 95, text: "$ paperclipDebug.get_issue_comments --issue-id TIA-184", tone: "cmd"},
  {at: 122, text: "comments loaded, no direct root-cause signal", tone: "warn"},
  {at: 148, text: "$ paperclipDebug.list_runs --issue-id TIA-184", tone: "cmd"},
  {at: 174, text: "multiple candidate runs, manual correlation needed", tone: "warn"},
];

const afterLines: TerminalLine[] = [
  {at: 0, text: "$ paperclipDebug.prioritize_incidents", tone: "cmd"},
  {at: 25, text: "topSignals: auth_failure, heartbeat_drift", tone: "output"},
  {at: 56, text: "$ paperclipDebug.trace_handoff --run-id 4578b76c", tone: "cmd"},
  {at: 85, text: "linked run->issue transition recovered", tone: "output"},
  {at: 118, text: "$ paperclipDebug.build_incident_packet --issue-id TIA-184", tone: "cmd"},
  {at: 150, text: "evidence packet ready for handoff", tone: "good"},
  {at: 183, text: "demo outcome: root-cause hypothesis faster", tone: "good"},
];

const toneColor = (tone: TerminalLine["tone"]): string => {
  if (tone === "cmd") {
    return "#8AF6FF";
  }
  if (tone === "warn") {
    return "#FFB986";
  }
  if (tone === "good") {
    return "#9DFFB0";
  }
  return "#D4DFEA";
};

const TerminalPanel: React.FC<{
  title: string;
  subtitle: string;
  lines: TerminalLine[];
  startFrame: number;
  frame: number;
  accent: string;
}> = ({title, subtitle, lines, startFrame, frame, accent}) => {
  const local = Math.max(frame - startFrame, 0);

  return (
    <div
      style={{
        flex: 1,
        borderRadius: 18,
        border: `1px solid ${accent}`,
        background: "rgba(8,14,22,0.82)",
        boxShadow: `0 0 26px ${accent}33`,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        minHeight: 470,
      }}
    >
      <div style={{fontSize: 26, fontWeight: 700, marginBottom: 4}}>{title}</div>
      <div style={{fontSize: 18, color: "#9DB0C3", marginBottom: 16}}>{subtitle}</div>
      <div
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 18,
          lineHeight: 1.5,
          overflow: "hidden",
        }}
      >
        {lines.map((line, index) => {
          const isVisible = local >= line.at;
          const progress = interpolate(local, [line.at, line.at + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.ease),
          });

          return (
            <div
              key={`${line.text}-${index}`}
              style={{
                opacity: isVisible ? progress : 0,
                transform: `translateY(${isVisible ? (1 - progress) * 10 : 10}px)`,
                color: toneColor(line.tone),
                marginBottom: 4,
                whiteSpace: "pre-wrap",
              }}
            >
              {line.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TerminalShowcase: React.FC = () => {
  const frame = useCurrentFrame();

  const overlayOpacity = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ctaOpacity = interpolate(frame, [720, 780], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 20%, #1B2D3E 0%, #0E1825 48%, #090F16 100%)",
        color: "#EAF1F8",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: overlayOpacity,
          background:
            "linear-gradient(110deg, rgba(255,185,134,0.08) 0%, rgba(138,246,255,0.05) 48%, rgba(157,255,176,0.08) 100%)",
        }}
      />
      <div style={{padding: "34px 44px 24px"}}>
        <div style={{fontSize: 42, fontWeight: 800}}>Paperclip Debug MCP in Terminal</div>
        <div style={{fontSize: 22, marginTop: 8, color: "#AFC0D1"}}>
          From fragmented investigation to one run-aware evidence flow
        </div>
      </div>

      <div style={{display: "flex", gap: 20, padding: "0 44px", marginTop: 8}}>
        <TerminalPanel
          title="Before"
          subtitle="Manual context rebuilding across scattered signals"
          lines={beforeLines}
          startFrame={40}
          frame={frame}
          accent="#FFB98666"
        />
        <TerminalPanel
          title="With Paperclip Debug MCP"
          subtitle="Unified investigation through MCP tools"
          lines={afterLines}
          startFrame={300}
          frame={frame}
          accent="#8AF6FF66"
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          right: 44,
          bottom: 30,
          borderRadius: 16,
          border: "1px solid rgba(138,246,255,0.45)",
          background: "rgba(10,16,26,0.86)",
          padding: "14px 18px",
          opacity: ctaOpacity,
        }}
      >
        <div style={{fontSize: 21, color: "#D6E2EE"}}>
          Looking for early testers:{" "}
          <span style={{color: "#8AF6FF", fontWeight: 700}}>
            github.com/andreykruogla-del/paperclip-debug-mcp
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
