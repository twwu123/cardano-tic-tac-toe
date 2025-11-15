import { BrowserWallet, UTxO } from "@meshsdk/core";
import { deserializeBech32Address, parseDatumCbor } from "@meshsdk/core-cst";
import { getTxBuilder } from "./utils";
import { scriptCbor } from "./contract-types";

export const move = async (
  position: number,
  scriptUtxo: UTxO,
  wallet: BrowserWallet
) => {
  const datum = parseDatumCbor(scriptUtxo.output.plutusData as string);
  const changeAddress = await wallet.getChangeAddress();
  const pubKeyHash = deserializeBech32Address(changeAddress).pubKeyHash;
  const playerValue = datum.fields[1].bytes === pubKeyHash ? "01" : "02";

  // Update the board state
  const boardState = datum.fields[0].bytes as string;

  // Split the board state into an array of 2-character cells
  const cells: string[] = [];
  for (let i = 0; i < boardState.length; i += 2) {
    cells.push(boardState.slice(i, i + 2));
  }

  // Update the cell at the specified position
  cells[position] = playerValue;

  // Join the cells back into a single string
  const newBoardState = cells.join("");

  // Update the datum with the new board state
  datum.fields[0].bytes = newBoardState;

  if (datum.fields[3].bytes === datum.fields[1].bytes) {
    datum.fields[3].bytes = datum.fields[2].bytes;
  } else {
    datum.fields[3].bytes = datum.fields[1].bytes;
  }

  const utxos = await wallet.getUtxos();
  const collateralUtxos = await wallet.getCollateral();
  const txBuilder = getTxBuilder();
  const tx = await txBuilder
    .selectUtxosFrom(utxos)
    .spendingPlutusScriptV3()
    .txIn(
      scriptUtxo.input.txHash,
      scriptUtxo.input.outputIndex,
      scriptUtxo.output.amount,
      scriptUtxo.output.address,
      0
    )
    .txInRedeemerValue({
      alternative: 0,
      fields: [{ alternative: 0, fields: [position, pubKeyHash] }],
    })
    .txInInlineDatumPresent()
    .txInScript(scriptCbor)
    .txOut(scriptUtxo.output.address, [
      {
        unit: "lovelace",
        quantity: "2000000",
      },
    ])
    .txOutInlineDatumValue(datum, "JSON")
    .requiredSignerHash(pubKeyHash)
    .changeAddress(changeAddress)
    .txInCollateral(
      collateralUtxos[0].input.txHash,
      collateralUtxos[0].input.outputIndex,
      collateralUtxos[0].output.amount,
      collateralUtxos[0].output.address
    )
    .complete();
  const signedTx = await wallet.signTx(tx, true);
  const txHash = await wallet.submitTx(signedTx);
  console.log("Transaction submitted with hash:", txHash);
  return txHash;
};

export const claimWin = async (
  position: number,
  scriptUtxo: UTxO,
  wallet: BrowserWallet,
  winningIndicies: number[]
) => {
  console.log("Claiming win at position:", position);
  const datum = parseDatumCbor(scriptUtxo.output.plutusData as string);
  const changeAddress = await wallet.getChangeAddress();
  const pubKeyHash = deserializeBech32Address(changeAddress).pubKeyHash;
  const playerValue = datum.fields[1].bytes === pubKeyHash ? "01" : "02";

  // Update the board state
  const boardState = datum.fields[0].bytes as string;

  // Split the board state into an array of 2-character cells
  const cells: string[] = [];
  for (let i = 0; i < boardState.length; i += 2) {
    cells.push(boardState.slice(i, i + 2));
  }

  // Update the cell at the specified position
  cells[position] = playerValue;

  // Join the cells back into a single string
  const newBoardState = cells.join("");

  // Update the datum with the new board state
  datum.fields[0].bytes = newBoardState;

  if (datum.fields[3].bytes === datum.fields[1].bytes) {
    datum.fields[3].bytes = datum.fields[2].bytes;
  } else {
    datum.fields[3].bytes = datum.fields[1].bytes;
  }

  const winningState = playerValue === "01" ? 2 : 3;
  datum.fields[4].int = winningState;

  const utxos = await wallet.getUtxos();
  const collateralUtxos = await wallet.getCollateral();
  const txBuilder = getTxBuilder();
  const tx = await txBuilder
    .selectUtxosFrom(utxos)
    .spendingPlutusScriptV3()
    .txIn(
      scriptUtxo.input.txHash,
      scriptUtxo.input.outputIndex,
      scriptUtxo.output.amount,
      scriptUtxo.output.address,
      0
    )
    .txInRedeemerValue({
      alternative: 0,
      fields: [
        { alternative: 1, fields: [position, pubKeyHash, winningIndicies] },
      ],
    })
    .txInInlineDatumPresent()
    .txInScript(scriptCbor)
    .txOut(scriptUtxo.output.address, [
      {
        unit: "lovelace",
        quantity: "2000000",
      },
    ])
    .txOutInlineDatumValue(datum, "JSON")
    .requiredSignerHash(pubKeyHash)
    .changeAddress(changeAddress)
    .txInCollateral(
      collateralUtxos[0].input.txHash,
      collateralUtxos[0].input.outputIndex,
      collateralUtxos[0].output.amount,
      collateralUtxos[0].output.address
    )
    .complete();
  const signedTx = await wallet.signTx(tx, true);
  const txHash = await wallet.submitTx(signedTx);
  console.log("Transaction submitted with hash:", txHash);
  return txHash;
};

export const endGame = async (scriptUtxo: UTxO, wallet: BrowserWallet) => {
  console.log("Ending game");
  const utxos = await wallet.getUtxos();
  const collateralUtxos = await wallet.getCollateral();
  const txBuilder = getTxBuilder();
  const changeAddress = await wallet.getChangeAddress();
  const pubKeyHash = deserializeBech32Address(changeAddress).pubKeyHash;

  const tx = await txBuilder
    .selectUtxosFrom(utxos)
    .spendingPlutusScriptV3()
    .txIn(
      scriptUtxo.input.txHash,
      scriptUtxo.input.outputIndex,
      scriptUtxo.output.amount,
      scriptUtxo.output.address,
      0
    )
    .txInRedeemerValue({
      alternative: 2,
      fields: [],
    })
    .txInInlineDatumPresent()
    .txInScript(scriptCbor)
    .changeAddress(changeAddress)
    .requiredSignerHash(pubKeyHash)
    .txInCollateral(
      collateralUtxos[0].input.txHash,
      collateralUtxos[0].input.outputIndex,
      collateralUtxos[0].output.amount,
      collateralUtxos[0].output.address
    )
    .complete();
  const signedTx = await wallet.signTx(tx, true);
  const txHash = await wallet.submitTx(signedTx);
  console.log("Transaction submitted with hash:", txHash);
  return txHash;
};
