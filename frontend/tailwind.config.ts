import fs from "node:fs";
import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Convert image to base64
const imageToBase64 = (path: string): string => {
  const bitmap = fs.readFileSync(path);
  return `data:image/png;base64,${Buffer.from(bitmap).toString("base64")}`;
};

const config: Config = {
  prefix: "ui-",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      backgroundImage: {
        "glow-conic":
          "conic-gradient(from 180deg at 50% 50%, #2a8af6 0deg, #a853ba 180deg, #e92a67 360deg)",
        "overview-bg":
          "url('/apps/abstraxion-dashboard/public/overviewBackground.png')",
        "modal-overlay": `url('${imageToBase64(
          "./src/assets/xion-bg-blur.png",
        )}')`,
        "modal-static": `url('${imageToBase64("./src/assets/static.png")}')`,
        "modal-static-2": `url('${imageToBase64("./src/assets/static2.png")}')`,
      },
      colors: {
        background: "hsl(var(--background))",
        "primary-text": "var(--primary-text)",
        "secondary-text": "var(--secondary-text)",
        border: "var(--border)",
        "border-focus": "var(--border-focus)",
        destructive: "hsl(var(--destructive))",
        primary: "#000",
        cta: "var(--cta)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        accent: {
          DEFAULT: "#6366F1",
          trust: "#0D9488",
          error: "#EF4444",
        },
        surface: {
          DEFAULT: "var(--surface)",
          page: "var(--surface-page)",
          border: "var(--surface-border)",
        },
        status: {
          info: { DEFAULT: "#2563EB", subtle: "#EFF6FF", border: "#BFDBFE" },
          warning: { DEFAULT: "#D97706", subtle: "#FFFBEB", border: "#FCD34D" },
          success: { DEFAULT: "#0D9488", subtle: "#ECFDF5", border: "#A7F3D0" },
        },
        mainnet: "#CAF033",
        "mainnet-bg": "rgba(4, 199, 0, 0.2)",
        testnet: "#FFAA4A",
        "testnet-bg": "rgba(255, 170, 74, 0.2)",
        inactive: "#BDBDBD",
        inputError: "#D74506",
        "disabled-bg": "#949494",
        "disabled-text": "#575454",
        warning: "hsl(var(--warning))",
      },
      borderRadius: {
        card: "16px",
        button: "10px",
        xl: "16px",
        lg: "10px",
        md: "10px",
      },
      // Typography scale based on √φ (1.272) ratio: 12 → 14 → 18 → 23 → 29
      // Line heights use φ (1.618) for body, √φ (1.272) for headings
      fontSize: {
        "title-lg": ["29px", { lineHeight: "37px", fontWeight: "700" }],
        title: ["23px", { lineHeight: "29px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "29px", fontWeight: "400" }],
        body: ["14px", { lineHeight: "22px", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "16px", fontWeight: "400" }],
        label: ["12px", { lineHeight: "16px", fontWeight: "600", letterSpacing: "0.05em" }],
      },
      transitionDuration: {
        fast: "150ms",
        normal: "250ms",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "fade-in": "fadeIn 250ms ease-out",
        "scale-in": "scaleIn 250ms ease-out",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      flexGrow: {
        "2": "2",
      },
      fontFamily: {
        akkuratLL: ["var(--font-akkuratLL)"],
      },
      padding: {
        safe: "env(safe-area-inset-bottom)",
      },
      typography: {
        navigation: {
          css: {
            fontFamily: "akkuratLL",
            fontSize: "1.2rem",
            fontWeight: "400",
            lineHeight: "1.4rem",
            letterSpacing: "0.1rem",
            textTransform: "uppercase",
          },
        },
      },
    },
  },
  plugins: [animate],
};
export default config;
