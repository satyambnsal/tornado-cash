import React from "react";

interface SpinnerV2Props {
  size?: "sm" | "md" | "lg";
  color?: "white" | "black" | "blue";
}

const SPINNER_SIZES: Record<
  Exclude<SpinnerV2Props["size"], undefined>,
  number
> = {
  sm: 24,
  md: 48,
  lg: 64,
};

/**
 * SpinnerV2 - A customizable loading spinner component
 * @param {SpinnerV2Props} props - Component props
 * @param {('sm'|'md'|'lg')} [props.size='md'] - Size variant of the spinner
 * @returns {JSX.Element} Spinner component
 */
const SpinnerV2: React.FC<SpinnerV2Props> = ({
  size = "md",
  color = "black",
}) => {
  const pixelSize = SPINNER_SIZES[size];

  return (
    <div className="ui-flex ui-items-center ui-justify-center ui-overflow-hidden">
      <svg
        data-testid="spinner-v2-icon"
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 50 50"
        className="ui-animate-spin"
        style={{ animationDuration: "800ms" }}
        role="status"
        aria-label="Loading"
      >
        <defs>
          <linearGradient
            id="spinner-gradient"
            x1="30%"
            y1="20%"
            x2="40%"
            y2="100%"
            gradientUnits="userSpaceOnUse"
          >
            <stop
              offset="0%"
              stopColor={
                color === "white"
                  ? "rgba(255, 255, 255, 0)"
                  : color === "blue"
                    ? "rgba(37, 99, 235, 0)"
                    : "rgba(0, 0, 0, 0)"
              }
            />
            <stop
              offset="10%"
              stopColor={
                color === "white"
                  ? "rgba(255, 255, 255, 0.05)"
                  : color === "blue"
                    ? "rgba(37, 99, 235, 0.05)"
                    : "rgba(0, 0, 0, 0.05)"
              }
            />
            <stop
              offset="100%"
              stopColor={color === "white" ? "white" : color === "blue" ? "#2563EB" : "black"}
            />
          </linearGradient>
        </defs>
        <path
          d="M 25 5 A 20 20 0 1 1 24.999 5"
          fill="none"
          stroke="url(#spinner-gradient)"
          strokeWidth="8"
          pathLength="120"
          strokeDasharray="90 120"
        />
      </svg>
    </div>
  );
};

export default React.memo(SpinnerV2);
