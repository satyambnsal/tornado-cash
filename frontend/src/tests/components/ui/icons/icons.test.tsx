import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../..";
import {
  AccountWalletLogo,
  AvatarIcon,
  BrowserIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  CopyIcon,
  EmailIcon,
  EthereumLogo,
  KeplrLogo,
  MetamaskLogo,
  PasskeyIcon,
  RightArrowIcon,
  ScanIcon,
  Spinner,
  TrashIcon,
  USDCIcon,
  WalletIcon,
  XionIcon,
  EyeIcon,
  EyeOffIcon,
  CosmosLogo,
  InfoFilledIcon,
  InfoIcon,
  AppleLogoIcon,
  GoogleLogoIcon,
  GithubLogoIcon,
  XLogoIcon,
  WarningIcon,
  TikTokLogoIcon,
} from "../../../../components/ui/icons/index";
import { TikTokLogoIcon } from "../../../../components/ui/icons/TikTokLogo";

describe("Icon Components", () => {
  describe("AccountWalletLogo", () => {
    it("renders correctly", async () => {
      await render(<AccountWalletLogo />);
      expect(
        screen.getByTestId("account-wallet-logo-icon"),
      ).toBeInTheDocument();
    });
  });

  describe("AvatarIcon", () => {
    it("renders with custom colors", async () => {
      await render(<AvatarIcon color="#ff0000" backgroundColor="#0000ff" />);
      expect(screen.getByTestId("avatar-icon")).toBeInTheDocument();
    });
  });

  describe("BrowserIcon", () => {
    it("renders correctly", async () => {
      await render(<BrowserIcon />);
      expect(screen.getByTestId("browser-icon")).toBeInTheDocument();
    });
  });

  describe("CheckIcon", () => {
    it("renders with default color", async () => {
      await render(<CheckIcon />);
      expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    });

    it("renders with custom color", async () => {
      await render(<CheckIcon color="red" />);
      const icon = screen.getByTestId("check-icon");
      expect(icon.querySelector("path")).toHaveAttribute("stroke", "red");
    });
  });

  describe("ChevronDownIcon", () => {
    it("renders in default down position", async () => {
      await render(<ChevronDownIcon />);
      const icon = screen.getByTestId("chevron-down-icon");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveStyle({ transform: "" });
    });

    it("renders rotated when isUp is true", async () => {
      await render(<ChevronDownIcon isUp />);
      const icon = screen.getByTestId("chevron-down-icon");
      expect(icon).toHaveStyle({ transform: "rotate(180deg)" });
    });

    it("applies custom className", async () => {
      await render(<ChevronDownIcon className="custom-class" />);
      const icon = screen.getByTestId("chevron-down-icon");
      expect(icon).toHaveClass("custom-class");
    });
  });

  describe("CloseIcon", () => {
    it("renders correctly", async () => {
      await render(<CloseIcon />);
      expect(screen.getByTestId("close-icon")).toBeInTheDocument();
    });

    it("handles onClick", async () => {
      const handleClick = vi.fn();
      const { user } = await render(<CloseIcon onClick={handleClick} />);
      await user.click(screen.getByTestId("close-icon"));
      expect(handleClick).toHaveBeenCalled();
    });

    it("applies custom className", async () => {
      await render(<CloseIcon className="custom-close" />);
      expect(screen.getByTestId("close-icon")).toHaveClass("custom-close");
    });

    it("uses custom strokeWidth", async () => {
      await render(<CloseIcon strokeWidth={3} />);
      const icon = screen.getByTestId("close-icon");
      expect(icon).toHaveAttribute("stroke-width", "3");
    });
  });

  describe("CopyIcon", () => {
    it("renders correctly", async () => {
      await render(<CopyIcon />);
      expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
    });
  });

  describe("EmailIcon", () => {
    it("renders correctly", async () => {
      await render(<EmailIcon />);
      expect(screen.getByTestId("email-icon")).toBeInTheDocument();
    });

    it("applies custom className", async () => {
      await render(<EmailIcon className="custom-email" />);
      expect(screen.getByTestId("email-icon")).toHaveClass("custom-email");
    });
  });

  describe("EthereumLogo", () => {
    it("renders correctly", async () => {
      await render(<EthereumLogo />);
      expect(screen.getByTestId("ethereum-logo-icon")).toBeInTheDocument();
    });

    it("applies custom className", async () => {
      await render(<EthereumLogo className="custom-eth" />);
      expect(screen.getByTestId("ethereum-logo-icon")).toHaveClass(
        "custom-eth",
      );
    });
  });

  describe("KeplrLogo", () => {
    it("renders correctly", async () => {
      await render(<KeplrLogo />);
      expect(screen.getByTestId("keplr-logo-icon")).toBeInTheDocument();
    });
  });

  describe("MetamaskLogo", () => {
    it("renders correctly", async () => {
      await render(<MetamaskLogo />);
      expect(screen.getByTestId("metamask-logo-icon")).toBeInTheDocument();
    });
  });

  describe("PasskeyIcon", () => {
    it("renders correctly", async () => {
      await render(<PasskeyIcon />);
      expect(screen.getByTestId("passkey-icon")).toBeInTheDocument();
    });
  });

  describe("RightArrowIcon", () => {
    it("renders correctly", async () => {
      await render(<RightArrowIcon />);
      expect(screen.getByTestId("right-arrow-icon")).toBeInTheDocument();
    });
  });

  describe("ScanIcon", () => {
    it("renders correctly", async () => {
      await render(<ScanIcon />);
      expect(screen.getByTestId("scan-icon")).toBeInTheDocument();
    });
  });

  describe("Spinner", () => {
    it("renders with default size", async () => {
      await render(<Spinner />);
      const spinner = screen.getByTestId("spinner-icon");
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute("width", "1.25rem");
    });

    it("renders with large size", async () => {
      await render(<Spinner size="large" />);
      const spinner = screen.getByTestId("spinner-icon");
      expect(spinner).toHaveAttribute("width", "4rem");
    });
  });

  describe("TrashIcon", () => {
    it("renders correctly", async () => {
      await render(<TrashIcon />);
      expect(screen.getByTestId("trash-icon")).toBeInTheDocument();
    });
  });

  describe("USDCIcon", () => {
    it("renders correctly", async () => {
      await render(<USDCIcon />);
      expect(screen.getByTestId("usdc-icon")).toBeInTheDocument();
    });
  });

  describe("WalletIcon", () => {
    it("renders correctly", async () => {
      await render(<WalletIcon />);
      expect(screen.getByTestId("wallet-icon")).toBeInTheDocument();
    });
  });

  describe("XionIcon", () => {
    it("renders correctly", async () => {
      await render(<XionIcon />);
      expect(screen.getByTestId("xion-icon")).toBeInTheDocument();
    });
  });

  describe("EyeIcon", () => {
    it("renders correctly", async () => {
      await render(<EyeIcon />);
      expect(screen.getByTestId("eye-icon")).toBeInTheDocument();
    });
  });

  describe("EyeOffIcon", () => {
    it("renders correctly", async () => {
      await render(<EyeOffIcon />);
      expect(screen.getByTestId("eye-off-icon")).toBeInTheDocument();
    });
  });

  describe("CosmosLogo", () => {
    it("renders correctly", async () => {
      await render(<CosmosLogo />);
      expect(screen.getByTestId("cosmos-logo-icon")).toBeInTheDocument();
    });

    it("applies custom className", async () => {
      await render(<CosmosLogo className="custom-cosmos" />);
      expect(screen.getByTestId("cosmos-logo-icon")).toHaveClass(
        "custom-cosmos",
      );
    });
  });

  describe("InfoFilledIcon", () => {
    it("renders correctly", async () => {
      await render(<InfoFilledIcon />);
      expect(screen.getByTestId("info-filled-icon")).toBeInTheDocument();
    });
  });

  describe("InfoIcon", () => {
    it("renders correctly", async () => {
      await render(<InfoIcon />);
      expect(screen.getByTestId("info-icon")).toBeInTheDocument();
    });
  });

  describe("AppleLogoIcon", () => {
    it("renders correctly", async () => {
      await render(<AppleLogoIcon />);
      expect(screen.getByTestId("apple-logo-icon")).toBeInTheDocument();
    });
  });

  describe("GoogleLogoIcon", () => {
    it("renders correctly", async () => {
      await render(<GoogleLogoIcon />);
      expect(screen.getByTestId("google-logo-icon")).toBeInTheDocument();
    });
  });

  describe("GithubLogoIcon", () => {
    it("renders correctly", async () => {
      await render(<GithubLogoIcon />);
      expect(screen.getByTestId("github-logo-icon")).toBeInTheDocument();
    });
  });

  describe("XLogoIcon", () => {
    it("renders correctly", async () => {
      await render(<XLogoIcon />);
      expect(screen.getByTestId("x-logo-icon")).toBeInTheDocument();
    });
  });

  describe("WarningIcon", () => {
    it("renders correctly", async () => {
      await render(<WarningIcon />);
      expect(screen.getByTestId("warning-icon")).toBeInTheDocument();
    });
  });

  describe("TikTokLogoIcon", () => {
    it("renders correctly", async () => {
      await render(<TikTokLogoIcon />);
      expect(screen.getByTestId("tiktok-logo-icon")).toBeInTheDocument();
    });
  });
});
