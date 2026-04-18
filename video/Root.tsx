import React from "react";
import {Composition} from "remotion";
import {XExplainer} from "./XExplainer";

export const VideoRoot: React.FC = () => {
  return (
    <Composition
      id="XExplainer"
      component={XExplainer}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{}}
    />
  );
};
