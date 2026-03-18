import React from "react";

interface SpinnerProps {
  size?: "default" | "large";
}

export const Spinner = ({ size = "default" }: SpinnerProps) => {
  const dimensions = size === "large" ? "4rem" : "1.25rem";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={dimensions}
      height={dimensions}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid"
      data-testid="spinner-icon"
    >
      <circle
        cx="50"
        cy="50"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        r="35"
        strokeDasharray="164.93361431346415 56.97787143782138"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          repeatCount="indefinite"
          dur="1.25s"
          values="0 50 50;360 50 50"
          keyTimes="0;1"
        ></animateTransform>
      </circle>
    </svg>
  );
};
