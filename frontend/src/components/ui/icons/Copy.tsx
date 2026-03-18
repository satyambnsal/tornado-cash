import React from "react";

export const CopyIcon = ({
  color,
  width = 11,
  height = 13,
}: {
  color: string;
  width?: number;
  height?: number;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 11 13"
    fill="none"
    data-testid="copy-icon"
  >
    <g stroke={color} strokeWidth="1.5">
      <path d="M3.5347 3.5347h6.875V12.1875H3.5347z" />
      <path d="M0.75 9.1945V1.5c0-.4142.3358-.75.75-.75h6.8056" />
    </g>
  </svg>
);
