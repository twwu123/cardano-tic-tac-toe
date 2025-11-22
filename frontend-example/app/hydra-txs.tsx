"use client";
import { HydraProvider } from "@meshsdk/hydra";

export const getCurrentUtxoSet = async () => {
  const hydraProvider = new HydraProvider({
    httpUrl: "http://localhost:4001",
  });
  const utxos = await hydraProvider.fetchUTxOs();
  console.log("Current UTxO set in Hydra head:", JSON.stringify(utxos));
};
