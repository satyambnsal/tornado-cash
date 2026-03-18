import React from "react";
import { isMainnet } from "../../config";

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);

export const SecuredByXion = () => {
  const colorClass = isMainnet() ? "ui-text-mainnet" : "ui-text-testnet";
  return (
    <div className="ui-flex ui-items-center ui-justify-center ui-gap-1">
      <ShieldIcon className={colorClass} />
      <span className={`ui-text-caption ui-font-medium ${colorClass}`}>
        Secured by XION
      </span>
    </div>
  );
};
