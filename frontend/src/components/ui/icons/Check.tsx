import React from "react";

export const CheckIcon = ({ color = "black" }: { color?: string }) => (
  <svg
    data-testid="check-icon"
    width="15"
    height="12"
    viewBox="0 0 15 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      id="Checkmark"
      d="M1 5.55556L5.28571 10L14 1"
      stroke={color}
      strokeWidth="1.5"
    />
  </svg>
);
