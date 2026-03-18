import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Custom plugin to redirect vite-plugin-node-polyfills shim imports from nested dependencies
function resolveNodePolyfillShims(): Plugin {
  const shimsDir = path.resolve(
    __dirname,
    "node_modules/vite-plugin-node-polyfills/shims",
  );
  return {
    name: "resolve-node-polyfill-shims",
    enforce: "pre",
    resolveId(source) {
      // Handle all vite-plugin-node-polyfills shim imports
      if (source.startsWith("vite-plugin-node-polyfills/shims/")) {
        const shimName = source.replace(
          "vite-plugin-node-polyfills/shims/",
          "",
        );
        return path.resolve(shimsDir, shimName, "dist/index.js");
      }
      return null;
    },
  };
}

export default defineConfig(({ mode }) => {
  // Map Vite mode to Cloudflare environment
  // For mainnet-beta and testnet-beta, use the mode as the environment
  // For mainnet and testnet, also use the mode
  const cloudflareEnv = [
    "mainnet",
    "testnet",
    "mainnet-beta",
    "testnet-beta",
  ].includes(mode)
    ? mode
    : undefined;

  return {
    plugins: [
      resolveNodePolyfillShims(),
      react(),
      // @ts-expect-error - Cloudflare plugin types mismatch
      cloudflare({
        // Pass the environment to Cloudflare plugin
        ...(cloudflareEnv && { environment: cloudflareEnv }),
      }),
      nodePolyfills({
        // Enable polyfills for browser globals needed by Cosmos libraries
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
        // Enable polyfills for Node.js built-in modules
        protocolImports: true,
        // Include specific modules that are failing
        include: ["buffer", "stream", "util", "crypto"],
        // Override default polyfills
        overrides: {
          fs: "memfs",
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        stream: "stream-browserify",
        buffer: "buffer",
        // Force all react imports to resolve to the same version
        react: path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
        "react/jsx-runtime": path.resolve(
          __dirname,
          "node_modules/react/jsx-runtime",
        ),
        "react/jsx-dev-runtime": path.resolve(
          __dirname,
          "node_modules/react/jsx-dev-runtime",
        ),
      },
      // Force deduplication of React packages
      dedupe: ["react", "react-dom"],
    },
    server: {
      port: 3000, // Match the port in dashboard .env files
      cors: true, // Enable CORS for iframe communication
    },
    build: {
      outDir: "dist",
      sourcemap: false, // Disable for production (source maps are too large for Cloudflare)
      // Single entry point - all routes handled by SPA routing
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        // Force rollup to use our aliased React for all imports
        external: [],
      },
    },
    define: {
      // Fix process.env references
      "process.env": {},
      global: "globalThis",
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
      include: [
        "buffer",
        "process",
        "@tanstack/react-query",
        "react",
        "react-dom",
      ],
    },
  };
});
