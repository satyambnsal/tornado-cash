import React from "react";

export const ChevronRightIcon = ({
  color,
  className,
}: {
  color?: string;
  className?: string;
}) => (
  <svg
    data-testid="chevron-right-icon"
    xmlns="http://www.w3.org/2000/svg"
    width="6"
    height="11"
    viewBox="0 0 6 11"
    fill="none"
    className={className}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0.292893 10.2071C-0.097631 9.81658 -0.097631 9.18342 0.292893 8.79289L3.58579 5.5L0.292893 2.20711C-0.0976311 1.81658 -0.0976311 1.18342 0.292893 0.792893C0.683417 0.402369 1.31658 0.402369 1.70711 0.792893L5.70711 4.79289C6.09763 5.18342 6.09763 5.81658 5.70711 6.20711L1.70711 10.2071C1.31658 10.5976 0.683417 10.5976 0.292893 10.2071Z"
      fill={color}
    />
  </svg>
);
