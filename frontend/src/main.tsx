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
import { networkConfig, CHAIN_ID, TORNADO_CONTRACT_ADDRESS } from "./config";

import "./index.css";
import "@burnt-labs/ui/dist/index.css";

const treasuryConfig = {
  treasury: "xion17vs7hqnlfxdmltv6hl49mqtmyp259x6av37mtu6znfyj4em53vgqesa4zg",
  rpcUrl: networkConfig.xionRpcUrl,
  restUrl: networkConfig.xionApiUrl,
  chainId: CHAIN_ID,
  // Treasury provides fee grants for XION Account Abstraction
  contracts: [
    {
      address: TORNADO_CONTRACT_ADDRESS,
      amounts: [{ denom: "uxion", amount: "1000000000" }], // Max amount the contract can use (1000 XION)
    },
  ],
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AbstraxionProvider config={treasuryConfig}>
    <TornadoProvider>
      <SimpleTornadoCashApp />
    </TornadoProvider>
  </AbstraxionProvider>,
);
