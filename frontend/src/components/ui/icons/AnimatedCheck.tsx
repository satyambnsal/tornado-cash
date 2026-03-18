import React from "react";

const AnimatedCheckmark = () => {
  return (
    <div
      className="ui-flex ui-items-center ui-justify-center ui-w-24 ui-h-24"
      aria-label="Animated checkmark"
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
          data-testid="animated-check-icon"
          viewBox="0 0 100 100"
          className="ui-w-full ui-h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#2563EB"
            strokeWidth="10"
            style={{
              strokeDasharray: "283",
              strokeDashoffset: "283",
              animation:
                "drawCircle 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards",
            }}
          />
          <path
            d="M30 50L45 65L70 35"
            fill="none"
            stroke="#2563EB"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: "75",
              strokeDashoffset: "75",
              animation:
                "drawCheck 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.4s forwards",
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

export default AnimatedCheckmark;
