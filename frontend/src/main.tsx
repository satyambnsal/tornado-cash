// Polyfills must be imported first
import { Buffer } from "buffer";
import process from "process";

window.Buffer = Buffer;
window.process = process;
window.global = window;

import ReactDOM from "react-dom/client";
import { AbstraxionProvider } from "@burnt-labs/abstraxion";
import { SimpleTornadoCashApp } from "./components/SimpleTornadoCashApp";
import { TornadoProvider } from "./context/TornadoContext";
import { networkConfig, CHAIN_ID } from "./config";

import "./index.css";
import "@burnt-labs/ui/dist/index.css";

const treasuryConfig = {
  treasury: undefined, // Optional treasury address
  rpcUrl: networkConfig.xionRpcUrl,
  restUrl: networkConfig.xionApiUrl,
  chainId: CHAIN_ID,
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AbstraxionProvider config={treasuryConfig}>
    <TornadoProvider>
      <SimpleTornadoCashApp />
    </TornadoProvider>
  </AbstraxionProvider>,
);
