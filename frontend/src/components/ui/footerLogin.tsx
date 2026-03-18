import xionLogo from "../../assets/logo.png";
import { isMainnet } from "../../config";

const FooterLogin = () => {
  return (
    <div className="ui-self-end ui-pointer-events-auto ui-w-full ui-z-[30] ui-flex ui-flex-col ui-gap-2 sm:ui-gap-12 ui-pb-safe ui-items-center sm:ui-flex-row sm:ui-justify-between sm:ui-items-end">
      <div className="ui-text-xs ui-font-normal ui-leading-5 ui-text-center sm:ui-text-left ui-max-w-[280px] sm:ui-max-w-full">
        <span className="ui-text-secondary-text">
          By continuing, you agree to and acknowledge that you have read and
          understand the
        </span>
        <a
          href="https://burnt.com/terms-and-conditions"
          className="ui-pl-1 ui-text-text-primary ui-underline ui-font-bold"
        >
          Disclaimer
        </a>
        <span className="ui-text-secondary-text">.</span>
      </div>
      <div className="ui-flex ui-gap-2 ui-justify-center ui-items-center sm:ui-my-0">
        <span
          className={`ui-text-xs sm:ui-text-sm ui-font-medium ui-text-nowrap ${
            isMainnet() ? "ui-text-mainnet" : "ui-text-testnet"
          }`}
        >
          Secured by
        </span>
        <a
          href="https://burnt.com/terms-and-conditions"
          className="ui-w-[70px] ui-h-[24px] sm:ui-w-[90px] sm:ui-h-[32px]"
        >
          <img src={xionLogo} alt="XION Logo" width="90" height="32" className="ui-brightness-0" />
        </a>
      </div>
    </div>
  );
};

export default FooterLogin;
