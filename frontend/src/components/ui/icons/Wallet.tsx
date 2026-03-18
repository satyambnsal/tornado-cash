import React from "react";

interface WalletIconProps {
  color: string;
  backgroundColor: string;
  width?: number;
  height?: number;
}

export const WalletIcon = ({
  color,
  backgroundColor,
  width = 16,
  height = 14,
}: WalletIconProps) => (
  <svg
    data-testid="wallet-icon"
    width={width}
    height={height}
    viewBox="0 0 16 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.5"
      y="0.882717"
      width="13.5882"
      height="9.35294"
      rx="1.5"
      stroke={color}
    />
    <path
      d="M0.5 11.6776V3.53782C0.934112 3.70797 1.44106 3.70745 1.82796 3.70705C1.84637 3.70704 1.86451 3.70702 1.88235 3.70702H14.1176C14.8811 3.70702 15.5 4.32592 15.5 5.08937V11.6776C15.5 12.4411 14.8811 13.06 14.1176 13.06H1.88235C1.1189 13.06 0.5 12.4411 0.5 11.6776Z"
      fill={backgroundColor}
      stroke={color}
    />
    <line x1="2.82349" y1="6.00147" x2="12.7058" y2="6.00147" stroke={color} />
  </svg>
);
