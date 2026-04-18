import React from "react";
import {Composition} from "remotion";
import {TerminalLoop} from "./TerminalLoop";
import {TerminalShowcase} from "./TerminalShowcase";
import {XExplainer} from "./XExplainer";

export const VideoRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="XExplainer"
        component={XExplainer}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
      <Composition
        id="TerminalShowcase"
        component={TerminalShowcase}
        durationInFrames={720}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{}}
      />
      <Composition
        id="TerminalLoop"
        component={TerminalLoop}
        durationInFrames={240}
        fps={30}
        width={960}
        height={540}
        defaultProps={{}}
      />
    </>
  );
};
