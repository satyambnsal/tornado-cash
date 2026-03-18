import React from "react";

const AnimatedX = () => {
  return (
    <div
      className="ui-flex ui-items-center ui-justify-center ui-w-24 ui-h-24"
      aria-label="Animated error"
      role="img"
    >
      <div
        className="ui-relative ui-w-full ui-h-full"
        style={{
          animation: "fadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          opacity: 0,
          transform: "scale(0.95)",
        }}
      >
        <svg
          data-testid="animated-x-icon"
          viewBox="0 0 100 100"
          className="ui-w-full ui-h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#EF4444"
            strokeWidth="10"
            style={{
              strokeDasharray: "283",
              strokeDashoffset: "283",
              animation:
                "drawCircle 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards",
            }}
          />
          <path
            d="M35 35L65 65"
            fill="none"
            stroke="#EF4444"
            strokeWidth="10"
            strokeLinecap="round"
            style={{
              strokeDasharray: "43",
              strokeDashoffset: "43",
              animation:
                "drawCheck 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.4s forwards",
            }}
          />
          <path
            d="M65 35L35 65"
            fill="none"
            stroke="#EF4444"
            strokeWidth="10"
            strokeLinecap="round"
            style={{
              strokeDasharray: "43",
              strokeDashoffset: "43",
              animation:
                "drawCheck 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.55s forwards",
            }}
          />
        </svg>
      </div>
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.7);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          @keyframes drawCircle {
            to {
              stroke-dashoffset: 0;
            }
          }

          @keyframes drawCheck {
            to {
              stroke-dashoffset: 0;
            }
          }
        `}
      </style>
    </div>
  );
};

export default AnimatedX;
