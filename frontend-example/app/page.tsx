"use client";

import { useState, useEffect } from "react";
import { BrowserWallet } from "@meshsdk/wallet";
import { BlockfrostProvider, UTxO } from "@meshsdk/core";
import { scriptAddress } from "./contract-types";
import { startGame } from "./start-game";
import { parseDatumCbor } from "@meshsdk/core-cst";
import { move, claimWin, endGame } from "./progress-game";

export default function Home() {
  const [wallet, setWallet] = useState<BrowserWallet | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);
  const [scriptUtxo, setScriptUtxo] = useState<UTxO | null>(null);
  const [gameCells, setGameCells] = useState<string>("000000000000000000");
  const [gameState, setGameState] = useState<number>(0);

  const blockfrost = new BlockfrostProvider(
    process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string
  );

  useEffect(() => {
    // Check for available wallets when component mounts
    checkAvailableWallets();

    const getGameState = async () => {
      console.log("Fetching game state from script address...");
      blockfrost.fetchAddressUTxOs(scriptAddress).then((utxos) => {
        setScriptUtxo(utxos.length > 0 ? utxos[0] : null);
      });
    };
    getGameState();
    // setInterval(getGameState, 5000);
  }, []);

  useEffect(() => {
    // Update rendered game state when scriptUtxo changes
    if (scriptUtxo) {
      const parsedDatum = parseDatumCbor(
        scriptUtxo.output.plutusData as string
      );
      setGameCells(parsedDatum.fields[0].bytes);
      setGameState(parsedDatum.fields[4].int);
    }
  }, [scriptUtxo]);

  useEffect(() => {
    console.log("Current game cells:", gameCells);
  }, [gameCells]);

  useEffect(() => {
    console.log("Current game state:", gameState);
  }, [gameState]);

  const checkAvailableWallets = () => {
    try {
      const wallets = BrowserWallet.getInstalledWallets();
      // Handle both string array and object array responses
      const walletNames = Array.isArray(wallets)
        ? wallets.map((w) => (typeof w === "string" ? w : w.name || "Unknown"))
        : [];
      setAvailableWallets(walletNames);
    } catch (error) {
      console.error("Error checking available wallets:", error);
      setAvailableWallets([]);
    }
  };

  const connectWallet = async (walletName?: string) => {
    setIsLoading(true);
    try {
      // If no specific wallet name provided, use the first available wallet
      const targetWallet = walletName || availableWallets[0];

      if (!targetWallet) {
        throw new Error("No wallets available");
      }

      const browserWallet = await BrowserWallet.enable(targetWallet);
      setWallet(browserWallet);

      // Get wallet address
      const addresses = await browserWallet.getUsedAddresses();
      if (addresses.length > 0) {
        setWalletAddress(addresses[0]);
        setIsConnected(true);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      alert(
        "Failed to connect wallet. Please make sure you have a Cardano wallet installed and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    setWalletAddress("");
    setIsConnected(false);
  };

  const shortenAddress = (address: string) => {
    if (address.length <= 20) return address;
    return `${address.slice(0, 10)}...${address.slice(-10)}`;
  };

  // Helper function to parse game state and render cell content
  const getCellContent = (index: number) => {
    const cellValue = gameCells.slice(index * 2, index * 2 + 2);
    if (cellValue === "01") return "X";
    if (cellValue === "02") return "O";
    return "";
  };

  // Check if a move results in a win
  const checkWin = (
    boardState: string,
    playerValue: string
  ): number[] | null => {
    // Split board state into cells
    const cells: string[] = [];
    for (let i = 0; i < boardState.length; i += 2) {
      cells.push(boardState.slice(i, i + 2));
    }

    // All possible winning combinations
    const winPatterns = [
      [0, 1, 2], // Top row
      [3, 4, 5], // Middle row
      [6, 7, 8], // Bottom row
      [0, 3, 6], // Left column
      [1, 4, 7], // Middle column
      [2, 5, 8], // Right column
      [0, 4, 8], // Diagonal top-left to bottom-right
      [2, 4, 6], // Diagonal top-right to bottom-left
    ];

    // Check each pattern
    for (const pattern of winPatterns) {
      if (
        cells[pattern[0]] === playerValue &&
        cells[pattern[1]] === playerValue &&
        cells[pattern[2]] === playerValue
      ) {
        return pattern;
      }
    }

    return null;
  };

  // Handle cell click
  const handleCellClick = async (index: number) => {
    if (wallet && scriptUtxo) {
      // Get the current player's value
      const datum = parseDatumCbor(scriptUtxo.output.plutusData as string);
      const changeAddress = await wallet.getChangeAddress();

      // Import deserializeBech32Address to get pubKeyHash
      const { deserializeBech32Address } = await import("@meshsdk/core-cst");
      const pubKeyHash = deserializeBech32Address(changeAddress).pubKeyHash;
      const playerValue = datum.fields[1].bytes === pubKeyHash ? "01" : "02";

      // Simulate the move
      const boardState = gameCells;
      const cells: string[] = [];
      for (let i = 0; i < boardState.length; i += 2) {
        cells.push(boardState.slice(i, i + 2));
      }
      cells[index] = playerValue;
      const newBoardState = cells.join("");

      // Check if this move wins
      const winningIndices = checkWin(newBoardState, playerValue);

      if (winningIndices) {
        // This move wins the game
        await claimWin(index, scriptUtxo, wallet, winningIndices);
      } else {
        // Regular move
        await move(index, scriptUtxo, wallet);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-8 border border-gray-200 dark:border-gray-700">
            <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
              Cardano Wallet Connection
            </h1>

            {!isConnected ? (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Connect your Cardano wallet to get started
                  </p>

                  {availableWallets.length === 0 ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                      <p className="text-yellow-800 dark:text-yellow-200">
                        No Cardano wallets detected. Please install a wallet
                        extension like:
                      </p>
                      <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                        <li>• Nami Wallet</li>
                        <li>• Eternl Wallet</li>
                        <li>• Flint Wallet</li>
                        <li>• Typhon Wallet</li>
                      </ul>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Available wallets ({availableWallets.length}):
                      </p>

                      {availableWallets.map((walletName) => (
                        <button
                          key={walletName}
                          onClick={() => connectWallet(walletName)}
                          disabled={isLoading}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 ease-in-out transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
                        >
                          {isLoading ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                              Connecting...
                            </div>
                          ) : (
                            `Connect ${walletName}`
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <button
                    onClick={checkAvailableWallets}
                    className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg text-sm"
                  >
                    Refresh Available Wallets
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
                    <p className="text-green-800 dark:text-green-200 font-semibold">
                      ✅ Wallet Connected Successfully!
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Wallet Address:
                    </p>
                    <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                      {shortenAddress(walletAddress)}
                    </p>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(walletAddress)
                      }
                      className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Copy full address
                    </button>
                    {wallet && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Wallet instance ready for transactions
                      </p>
                    )}
                  </div>

                  <button
                    onClick={disconnectWallet}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 ease-in-out"
                  >
                    Disconnect Wallet
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tic-Tac-Toe Game Section */}
          {isConnected && (
            <div className="mt-8">
              <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-8 border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
                  Tic-Tac-Toe Game
                </h2>

                <div className="flex justify-center">
                  <div className="grid grid-cols-3 gap-2 w-72 h-72">
                    {/* Row 1 */}
                    <div
                      onClick={() => handleCellClick(0)}
                      className="bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-4xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    >
                      {getCellContent(0)}
                    </div>
                    <div
                      onClick={() => handleCellClick(1)}
                      className="bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-4xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    >
                      {getCellContent(1)}
                    </div>
                    <div
                      onClick={() => handleCellClick(2)}
                      className="bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-4xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    >
                      {getCellContent(2)}
                    </div>

                    {/* Row 2 */}
                    <div
                      onClick={() => handleCellClick(3)}
                      className="bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-4xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    >
                      {getCellContent(3)}
                    </div>
                    <div
                      onClick={() => handleCellClick(4)}
                      className="bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-4xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    >
                      {getCellContent(4)}
                    </div>
                    <div
                      onClick={() => handleCellClick(5)}
                      className="bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-4xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    >
                      {getCellContent(5)}
                    </div>

                    {/* Row 3 */}
                    <div
                      onClick={() => handleCellClick(6)}
                      className="bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-4xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    >
                      {getCellContent(6)}
                    </div>
                    <div
                      onClick={() => handleCellClick(7)}
                      className="bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-4xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    >
                      {getCellContent(7)}
                    </div>
                    <div
                      onClick={() => handleCellClick(8)}
                      className="bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-4xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    >
                      {getCellContent(8)}
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  {scriptUtxo ? (
                    gameState == 1 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Active game found:{" "}
                        {scriptUtxo.input.txHash.slice(0, 10)}
                        ...
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                          Game over !
                        </p>
                        <button
                          onClick={async () => {
                            if (wallet) {
                              await endGame(scriptUtxo, wallet);
                            } else {
                              alert("Wallet not connected");
                            }
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                        >
                          End Game
                        </button>
                      </>
                    )
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        No active games found. Start a new game!
                      </p>
                      <button
                        onClick={async () => {
                          startGame(
                            "addr_test1qzhxkujg29rp6au6nwxg5eu9yq73xzk9gq30zy0v8t75uvanf04dmdu9p7xlkeksym6zlc057szy9py8muzkt8nptagqnsw8yx",
                            "addr_test1qrp0ert4hqff66z3th3d8lz3lqx8ln83tqaqcj74z55jgedgqeckjr38wfpvynqplxfk0dedgvtzwnwhvnkj9dnpthjq5zpydj"
                          );
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                      >
                        Start New Game
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Additional Info Section */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Powered by{" "}
              <a
                href="https://meshjs.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mesh SDK
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
