import { BlockfrostProvider, MeshTxBuilder } from "@meshsdk/core";

export const getTxBuilder = () => {
  const blockfrost = new BlockfrostProvider(
    process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string
  );
  const txBuilder = new MeshTxBuilder({
    fetcher: blockfrost,
    evaluator: blockfrost,
  });
  return txBuilder;
};
