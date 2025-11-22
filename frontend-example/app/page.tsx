"use client";

import { useState, useEffect } from "react";
import { BrowserWallet } from "@meshsdk/wallet";
import {
  initHead,
  commitToHead,
  closeHead,
  fanoutHead,
  sendFunds,
} from "./hydra-actions";
import { getCurrentUtxoSet } from "./hydra-txs";

export default function Home() {
  const [wallet, setWallet] = useState<BrowserWallet | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);
  const [sendAddress, setSendAddress] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("");

  useEffect(() => {
    // Check for available wallets when component mounts
    checkAvailableWallets();
  }, []);

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

          {/* Hydra Commands Section */}
          {isConnected && (
            <div className="mt-8">
              <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-8 border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
                  Hydra Commands
                </h2>

                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                      Initialize Hydra Head
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Initialize a new Hydra Head with connected participants
                    </p>
                    <button
                      onClick={initHead}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                    >
                      Initialize Head
                    </button>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                      Commit Funds
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Commit UTxOs to the Hydra Head
                    </p>
                    <button
                      onClick={commitToHead}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                    >
                      Commit
                    </button>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                      Close Head
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Close the Hydra Head and finalize state
                    </p>
                    <button
                      onClick={closeHead}
                      className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                    >
                      Close Head
                    </button>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                      Fanout
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Distribute final UTxOs to participants
                    </p>
                    <button
                      onClick={fanoutHead}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                    >
                      Fanout
                    </button>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                      Get Current UTxO Set
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Retrieve the current UTxO set in the Hydra Head
                    </p>
                    <button
                      onClick={() => {
                        getCurrentUtxoSet();
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                    >
                      Get UTxO Set
                    </button>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                      Send Funds
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Send funds to an address within the Hydra Head
                    </p>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={sendAddress}
                        onChange={(e) => setSendAddress(e.target.value)}
                        placeholder="Enter recipient address..."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        placeholder="Enter amount (lovelace)..."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => {
                          sendFunds(sendAddress, sendAmount);
                        }}
                        disabled={!sendAddress || !sendAmount}
                        className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-6 rounded-lg transition-colors"
                      >
                        Send
                      </button>
                    </div>
                  </div>
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
