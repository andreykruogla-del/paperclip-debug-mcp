import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Line = {
  from: number;
  to: number;
  speaker: "Speaker 1" | "Speaker 2";
  text: string;
};

const script: Line[] = [
  {
    from: 0,
    to: 75,
    speaker: "Speaker 1",
    text: "Debugging in Paperclip still feels fragmented.",
  },
  {
    from: 75,
    to: 180,
    speaker: "Speaker 1",
    text: "Runs, issues, comments, logs, and handoff traces live in different places.",
  },
  {
    from: 180,
    to: 270,
    speaker: "Speaker 2",
    text: "Paperclip Debug MCP unifies that investigation flow.",
  },
  {
    from: 270,
    to: 450,
    speaker: "Speaker 1",
    text: "One MCP interface for runs, events, issues, comments, service logs, and handoff context.",
  },
  {
    from: 450,
    to: 630,
    speaker: "Speaker 2",
    text: "Faster root-cause hypotheses, fewer debug loops, and clearer evidence for handoff.",
  },
  {
    from: 630,
    to: 840,
    speaker: "Speaker 1",
    text: "Using Paperclip and feeling this pain? Looking for a few early testers.",
  },
  {
    from: 840,
    to: 900,
    speaker: "Speaker 2",
    text: "Repo in post. Happy to help with setup.",
  },
];

const getActiveLine = (frame: number): Line => {
  return script.find((line) => frame >= line.from && frame < line.to) ?? script[0];
};

const Node: React.FC<{x: number; y: number; active: boolean; label: string}> = ({
  x,
  y,
  active,
  label,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 16,
        height: 16,
        borderRadius: 999,
        background: active ? "#7AF6FF" : "#7D8A99",
        boxShadow: active ? "0 0 24px rgba(122,246,255,0.8)" : "none",
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 18,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 26,
          color: "#C4D4E0",
          fontFamily: "Inter, system-ui, sans-serif",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const XExplainer: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const activeLine = getActiveLine(frame);

  const stage = interpolate(frame, [0, 180, 360, 540, 900], [0, 1, 2, 3, 4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  const introFade = interpolate(frame, [0, 45], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const exitFade = interpolate(frame, [855, 900], [1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const globalOpacity = introFade * exitFade;

  const centerScale = spring({
    fps,
    frame,
    config: {damping: 14, stiffness: 80},
  });

  const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * 2.4);

  return (
    <AbsoluteFill
      style={{
        opacity: globalOpacity,
        background:
          "radial-gradient(circle at 50% 45%, #172331 0%, #0F1722 45%, #0A0F17 100%)",
        color: "#ECF2F8",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(120deg, rgba(0,0,0,0.35) 0%, rgba(122,246,255,0.06) 50%, rgba(255,182,104,0.08) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 80,
          left: 60,
          right: 60,
          textAlign: "center",
          fontSize: 54,
          fontWeight: 700,
          letterSpacing: 0.8,
        }}
      >
        From Fragmentation to Flow
      </div>

      <div
        style={{
          position: "absolute",
          top: 150,
          left: 60,
          right: 60,
          textAlign: "center",
          fontSize: 30,
          color: "#9CB0C3",
        }}
      >
        Paperclip Debug MCP
      </div>

      <div
        style={{
          position: "absolute",
          left: width / 2,
          top: height / 2 - 120,
          transform: `translate(-50%, -50%) scale(${0.9 + centerScale * 0.1})`,
          fontSize: 330,
          lineHeight: 1,
          filter: `drop-shadow(0 20px 32px rgba(0,0,0,0.45)) drop-shadow(0 0 ${20 + pulse * 18}px rgba(122,246,255,0.35))`,
        }}
      >
        📎
      </div>

      <div
        style={{
          position: "absolute",
          left: 90,
          top: height / 2 - 130,
          width: 260,
          height: 260,
          borderRadius: 999,
          border: "2px solid rgba(255,182,104,0.45)",
          boxShadow: "0 0 30px rgba(255,182,104,0.25)",
          opacity: stage >= 0 ? 1 : 0,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 125,
          top: height / 2 - 90,
          width: 190,
          fontSize: 30,
          fontWeight: 700,
          color: "#FFBF85",
        }}
      >
        Fragmented
      </div>
      <div
        style={{
          position: "absolute",
          left: 125,
          top: height / 2 - 46,
          width: 240,
          fontSize: 26,
          color: "#CFD8E2",
        }}
      >
        logs + threads + traces
      </div>

      {stage >= 1 ? (
        <>
          <Node x={760} y={690} label="Runs" active={frame % 36 < 18} />
          <Node x={900} y={620} label="Events" active={frame % 42 < 21} />
          <Node x={980} y={770} label="Issues" active={frame % 48 < 24} />
          <Node x={860} y={860} label="Comments" active={frame % 38 < 19} />
          <Node x={1030} y={920} label="Logs" active={frame % 44 < 22} />
          <Node x={930} y={1020} label="Handoff" active={frame % 40 < 20} />
        </>
      ) : null}

      {stage >= 2 ? (
        <>
          <div
            style={{
              position: "absolute",
              left: 560,
              top: 700,
              width: 480,
              height: 2,
              background: "linear-gradient(90deg, rgba(122,246,255,0.2), rgba(122,246,255,0.9))",
              transform: "rotate(-11deg)",
              transformOrigin: "left center",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 560,
              top: 735,
              width: 510,
              height: 2,
              background: "linear-gradient(90deg, rgba(122,246,255,0.2), rgba(255,182,104,0.9))",
              transform: "rotate(9deg)",
              transformOrigin: "left center",
            }}
          />
        </>
      ) : null}

      {stage >= 3 ? (
        <div
          style={{
            position: "absolute",
            right: 70,
            top: 1150,
            width: 480,
            padding: "24px 28px",
            borderRadius: 24,
            background: "rgba(14,24,36,0.75)",
            border: "1px solid rgba(122,246,255,0.25)",
            boxShadow: "0 0 30px rgba(122,246,255,0.15)",
          }}
        >
          <div style={{fontSize: 30, fontWeight: 700, marginBottom: 10}}>Why it helps</div>
          <div style={{fontSize: 24, color: "#D2DEE9", lineHeight: 1.45}}>
            Faster hypotheses.
            <br />
            Fewer debug loops.
            <br />
            Clearer evidence packets.
          </div>
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          bottom: 90,
          borderRadius: 22,
          padding: "20px 24px",
          background: "rgba(8,14,22,0.84)",
          border: `1px solid ${activeLine.speaker === "Speaker 1" ? "rgba(255,182,104,0.5)" : "rgba(122,246,255,0.5)"}`,
        }}
      >
        <div
          style={{
            fontSize: 22,
            color: activeLine.speaker === "Speaker 1" ? "#FFBF85" : "#7AF6FF",
            marginBottom: 8,
            fontWeight: 700,
          }}
        >
          {activeLine.speaker}
        </div>
        <div style={{fontSize: 36, lineHeight: 1.2, fontWeight: 600}}>{activeLine.text}</div>
      </div>
    </AbsoluteFill>
  );
};
