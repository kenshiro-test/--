import React from "react";
import { Composition } from "remotion";
import { DreamPlannerShort } from "./DreamPlannerShort";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DreamPlannerShort"
      component={DreamPlannerShort}
      durationInFrames={528}
      fps={24}
      width={1080}
      height={1920}
    />
  );
};

