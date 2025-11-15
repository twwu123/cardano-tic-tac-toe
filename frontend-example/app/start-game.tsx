import { MeshWallet } from "@meshsdk/wallet";
import { BlockfrostProvider, deserializeAddress } from "@meshsdk/core";
import { MeshTxBuilder } from "@meshsdk/core";
import { scriptAddress, boardStateDatum } from "./contract-types";

export const startGame = async (
  userAddress: string,
  opponentAddress: string
) => {
  const blockfrost = new BlockfrostProvider(
    process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string
  );
  const wallet = new MeshWallet({
    fetcher: blockfrost,
    key: {
      type: "mnemonic",
      words: (process.env.NEXT_PUBLIC_SEED_PHRASE as string).split(" "),
    },
    networkId: 0,
  });
  const utxos = await wallet.getUtxos();
  const txBuilder = new MeshTxBuilder({ fetcher: blockfrost });

  const tx = await txBuilder
    .selectUtxosFrom(utxos)
    .txOut(scriptAddress, [
      {
        unit: "lovelace",
        quantity: "2000000",
      },
    ])
    .txOutInlineDatumValue(
      boardStateDatum(
        "000000000000000000",
        deserializeAddress(userAddress).pubKeyHash,
        deserializeAddress(opponentAddress).pubKeyHash,
        deserializeAddress(userAddress).pubKeyHash,
        1,
        0,
        0,
        0
      )
    )
    .changeAddress(await wallet.getChangeAddress())
    .complete();

  const signedTx = await wallet.signTx(tx);
  const txHash = await blockfrost.submitTx(signedTx);
  console.log("Transaction submitted with hash:", txHash);
  return txHash;
};
