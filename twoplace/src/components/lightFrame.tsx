"use client";

import React from "react";

type LightFrameProps = {
  color?: string;
  thickness?: number;
  brightness?: number;
  children: React.ReactNode;
};

const LightFrame: React.FC<LightFrameProps> = ({
  color = "#00ff99",
  thickness = 6,
  brightness = 0.6,
  children,
}) => {
  return (
    <div
      style={{
        boxShadow: `0 0 ${thickness * 2}px ${thickness}px ${color}`,
        border: `${thickness}px solid ${color}`,
        filter: `brightness(${brightness})`,
        borderRadius: "10px",
        padding: "12px",
      }}
    >
      {children}
    </div>
  );
};

export default LightFrame;
