import React from "react";

interface ZKEmailIconProps {
  className?: string;
}

export const ZKEmailIcon: React.FC<ZKEmailIconProps> = ({ className }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      width="40"
      height="40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Rounded square background */}
      <rect x="2" y="2" width="36" height="36" rx="10" fill="#111827" />

      {/* @ symbol – outer ring */}
      <circle
        cx="20"
        cy="16"
        r="9"
        stroke="#fff"
        strokeWidth="2.2"
        fill="none"
      />

      {/* @ symbol – inner circle */}
      <circle
        cx="20"
        cy="16"
        r="4"
        stroke="#fff"
        strokeWidth="2.2"
        fill="none"
      />

      {/* @ symbol – tail */}
      <path
        d="M24 16v5.5a2.5 2.5 0 0 0 5 0"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* ZK – large, bold, centered below */}
      {/* Z */}
      <path
        d="M10 29h7M17 29L10 36M10 36h7"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
      {/* K */}
      <path
        d="M23 29v7M23 32.5l5 -3.5M23 32.5l5 3.5"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
    </svg>
  );
};
