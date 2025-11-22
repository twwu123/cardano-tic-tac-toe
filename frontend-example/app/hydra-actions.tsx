"use server";
import { BlockfrostProvider, MeshTxBuilder } from "@meshsdk/core";
import { HydraInstance, HydraProvider } from "@meshsdk/hydra";
import { MeshWallet } from "@meshsdk/core";

export const initHead = async () => {
  const hydraProvider = new HydraProvider({
    httpUrl: "http://localhost:4001",
  });
  hydraProvider.onMessage((message) => {
    console.log(
      "Received message from Hydra Provider:",
      JSON.stringify(message)
    );
  });
  await hydraProvider.connect();
  await hydraProvider.init();
  console.log("Hydra head initialized.");
  hydraProvider.disconnect();
};

export const commitToHead = async () => {
  const hydraProvider = new HydraProvider({
    httpUrl: "http://localhost:4001",
  });
  hydraProvider.onMessage((message) => {
    console.log(
      "Received message from Hydra Provider:",
      JSON.stringify(message)
    );
  });
  const blockfrost = new BlockfrostProvider(
    process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string
  );
  await hydraProvider.connect();
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
  hydraProvider.disconnect();
};

export const closeHead = async () => {
  console.log("Closing hydra head...");
  const hydraProvider = new HydraProvider({
    httpUrl: "http://localhost:4001",
  });
  hydraProvider.onMessage((message) => {
    console.log(
      "Received message from Hydra Provider:",
      JSON.stringify(message)
    );
  });
  await hydraProvider.connect();
  await hydraProvider.close();
  console.log("Close command executed.");
  hydraProvider.disconnect();
  //   const txHash = await blockfrost.submitTx(
  //     "84aa00d901028282582013b588ffb4e48bedf89e55bfad4b8d993575aa7e6911cf67e939bec4177d18050082582013b588ffb4e48bedf89e55bfad4b8d993575aa7e6911cf67e939bec4177d1805010dd901028182582013b588ffb4e48bedf89e55bfad4b8d993575aa7e6911cf67e939bec4177d18050112d9010281825820a3a27a3049be1fe931a0d99bf132a88b848b12dc50f50856cb86e12bb135f5d2000182a300581d70a1442faf26d4ec409e2f62a685c1d4893f8d6bcbaf7bcb59d6fa134001821b000000025437d268a1581ce4af6ad6163e73c16edf571b3c93958809a469edc993fae18bcd71c6a24b487964726148656164563101581c95f92700b76d5e4860ff0042a0a41532b13ac8e8f07caa1c9221ee2c01028201d81858c3d87b9fd8799f581ce4af6ad6163e73c16edf571b3c93958809a469edc993fae18bcd71c69f58206af7c0bb12b521f2c36ccb2ae430453e9b3d96f40e9785b9bbe8a7313771aa55ffd8799f19ea60ff00005820713277d50e20e250766b13a3e5dfa3e724a012f0ca2c200a0cfb9fd41df1eb025820e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8555820e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855801b0000019aa62aeb70ffff82581d6095f92700b76d5e4860ff0042a0a41532b13ac8e8f07caa1c9221ee2c1a768c56c3021a001feacc031a067093ca081a0670938e0ed9010281581c95f92700b76d5e4860ff0042a0a41532b13ac8e8f07caa1c9221ee2c0b58209d83cb3815f95ccb0e571a70c5381b8263741274358bfac7cbe909c4949cb6be075820f5cf4df0aba78e42562e6b5ba81d6663a8e039210a0f3c3c711cfb6cbeef6e51a200d901028182582078ba7d07111f735d3b0a9bca5b57563c652e49dad6c3c56a9358c74ae482a7745840ba0cb076d3aa730435cdd43f7dd0d09745ecb56d3b6ae17a9010d4c18863a876e6cfc721bee64f6b888a94712cd90803d58e492222219537231d8f11a811ab0205a182000082d87c9fd87980ff821a00fbc5201b00000002540be400f5d90103a100a119d9036f487964726156312f436c6f73655478"
  //   );
  //   console.log(txHash);
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
    hydraWs.close();
  };
  console.log("Fanout command executed.");
};

export const sendFunds = async (address: string, amount: string) => {
  const hydraProvider = new HydraProvider({
    httpUrl: "http://localhost:4001",
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
  await hydraProvider.connect();
  const txHash = await hydraProvider.submitTx(signedTx);
  console.log("Sent funds tx hash:", txHash);
  hydraProvider.disconnect();
};
