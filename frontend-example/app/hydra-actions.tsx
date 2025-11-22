"use server";
import { BlockfrostProvider, MeshTxBuilder } from "@meshsdk/core";
import { HydraInstance, HydraProvider } from "@meshsdk/hydra";
import { MeshWallet } from "@meshsdk/core";

// Create a single instance at module level
let hydraProvider: HydraProvider | null = null;

async function getHydraProvider() {
  if (!hydraProvider) {
    console.log("Creating new HydraProvider instance...");
    hydraProvider = new HydraProvider({
      httpUrl: "http://localhost:4001",
    });
    console.log("Connecting to Hydra...");
    await hydraProvider.connect();
    console.log("Connected to Hydra successfully!");
  }
  return hydraProvider;
}

export const initHead = async () => {
  console.log("=== INIT HEAD CALLED ===");
  const hydraProvider = await getHydraProvider();
  // Re-register message handler before operation
  hydraProvider.onMessage((message) => {
    console.log("=== HYDRA MESSAGE (initHead) ===");
    console.log(JSON.stringify(message, null, 2));
    console.log("=================================");
  });
  console.log("Got hydra provider, calling init...");
  await hydraProvider.init();
  console.log("=== INIT HEAD COMPLETE ===");
};

export const commitToHead = async () => {
  const hydraProvider = await getHydraProvider();
  // Re-register message handler before operation
  hydraProvider.onMessage((message) => {
    console.log("=== HYDRA MESSAGE (commitToHead) ===");
    console.log(JSON.stringify(message, null, 2));
    console.log("=====================================");
  });
  const blockfrost = new BlockfrostProvider(
    process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string
  );
  console.log("Committing to hydra head...");
  const hydraInstance = new HydraInstance({
    provider: hydraProvider,
    fetcher: blockfrost,
    submitter: blockfrost,
  });
  // Fetch UTxOs from alice-funds address
  const commitUtxos = await blockfrost.fetchAddressUTxOs(
    "addr_test1vzd3grmm08mkvv7kzpqqpmy6ycxef0lmk3sehzglkr83pxslv0rh9"
  );
  const commitTx = await hydraInstance.commitFunds(
    commitUtxos[0].input.txHash,
    commitUtxos[0].input.outputIndex
  );
  const aliceFundsWallet = new MeshWallet({
    networkId: 0,
    key: {
      type: "cli",
      payment: process.env.NEXT_PUBLIC_ALICE_FUNDS_SK as string,
    },
  });

  const signedCommitTx = await aliceFundsWallet.signTx(commitTx, true);
  console.log(signedCommitTx);
  const commitTxHash = await hydraInstance.submitter.submitTx(signedCommitTx);
  console.log("Commit transaction submitted with hash:", commitTxHash);
};

export const closeHead = async () => {
  console.log("Closing hydra head...");
  const hydraProvider = await getHydraProvider();
  // Re-register message handler before operation
  hydraProvider.onMessage((message) => {
    console.log("=== HYDRA MESSAGE (closeHead) ===");
    console.log(JSON.stringify(message, null, 2));
    console.log("==================================");
  });
  await hydraProvider.close();
  console.log("Close command executed.");
};

export const fanoutHead = async () => {
  console.log("Fanning out hydra head...");
  const hydraWs = new WebSocket("ws://localhost:4001");
  hydraWs.onmessage = (event) => {
    console.log("Received message from Hydra WS:", JSON.stringify(event.data));
  };
  hydraWs.onopen = () => {
    console.log("Hydra WS connection opened.");
    hydraWs.send(JSON.stringify({ tag: "Fanout" }));
  };
  console.log("Fanout command executed.");
};

export const sendFunds = async (address: string, amount: string) => {
  const hydraProvider = await getHydraProvider();
  // Re-register message handler before operation
  hydraProvider.onMessage((message) => {
    console.log("=== HYDRA MESSAGE (sendFunds) ===");
    console.log(JSON.stringify(message, null, 2));
    console.log("==================================");
  });
  const txBuilder = new MeshTxBuilder({
    isHydra: true,
    fetcher: hydraProvider,
  });
  const wallet = new MeshWallet({
    networkId: 0,
    key: {
      type: "cli",
      payment: process.env.NEXT_PUBLIC_ALICE_FUNDS_SK as string,
    },
  });
  const utxos = await hydraProvider.fetchAddressUTxOs(
    "addr_test1vzd3grmm08mkvv7kzpqqpmy6ycxef0lmk3sehzglkr83pxslv0rh9"
  );
  const txHex = await txBuilder
    .txOut(address, [{ unit: "lovelace", quantity: amount }])
    .changeAddress(
      "addr_test1vzd3grmm08mkvv7kzpqqpmy6ycxef0lmk3sehzglkr83pxslv0rh9"
    )
    .selectUtxosFrom(utxos)
    .complete();
  const signedTx = await wallet.signTx(txHex, true);
  console.log("Signed tx:", signedTx);
  const txHash = await hydraProvider.submitTx(signedTx);
  console.log("Sent funds tx hash:", txHash);
};
