import { useState } from "react";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

function parseInputToBytes(input: string): Uint8Array {
  const trimmed = input.trim();
  try {
    const arr = JSON.parse(trimmed);
    if (Array.isArray(arr)) {
      return new Uint8Array(arr);
    }
  } catch {
    void 0;
  }

  const parts = trimmed
    .replace(/\[|\]/g, "")
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((v) => Number(v));

  return new Uint8Array(parts);
}

export default function SecretKeyTool() {
  const [input, setInput] = useState("");
  const [secretBase58, setSecretBase58] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [hideInput, setHideInput] = useState(true);
  const [hideOutputSecret, setHideOutputSecret] = useState(true);

  const onConvert = () => {
    setError("");
    setSecretBase58("");
    setAddress("");
    try {
      const bytes = parseInputToBytes(input);
      if (!(bytes.length === 64 || bytes.length === 32)) {
        throw new Error("Expected an array private key of 32 or 64 bytes");
      }

      const kp = bytes.length === 64 ? Keypair.fromSecretKey(bytes) : Keypair.fromSeed(bytes);
      setSecretBase58(bs58.encode(kp.secretKey));
      setAddress(kp.publicKey.toBase58());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Array Private Key → Base58 & Address</h2>
      <div className="flex items-center gap-2">
        <input
          type={hideInput ? "password" : "text"}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          placeholder="Example: [12,34,...] or 12,34,..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          aria-label={hideInput ? "Show" : "Hide"}
          className="p-2 rounded-md border border-neutral-700"
          onClick={() => setHideInput((v) => !v)}
        >
          {hideInput ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 110-10 5 5 0 010 10z"/>
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M2 12s3 7 10 7c2.2 0 4.1-.6 5.7-1.5l2.8 2.8 1.4-1.4L4.4 3.4 3 4.8l3.1 3.1C4.4 9.2 3 11.1 2 12zm9.9-5c.1 0 .1 0 0 0l6.1 6.1c1.2-1.3 2-2.7 2-2.7s-3-7-10-7c-.6 0-1.2 0-1.7.1l1.7 1.6c.6-.1 1.2-.1 1.9-.1z"/>
            </svg>
          )}
        </button>
      </div>
      <div className="flex gap-2">
        <button
          className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
          onClick={onConvert}
        >
          Convert
        </button>
        <button
          className="px-3 py-2 rounded-md border border-neutral-700 text-sm"
          onClick={() => {
            setInput("");
            setSecretBase58("");
            setAddress("");
            setError("");
          }}
        >
          Clear
        </button>
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {!!secretBase58 && (
        <div className="space-y-2">
          <div>
            <div className="text-xs text-neutral-400">Base58 Secret Key</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 break-all rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">
                {hideOutputSecret ? "•".repeat(secretBase58.length) : secretBase58}
              </div>
              <button
                aria-label={hideOutputSecret ? "Show" : "Hide"}
                className="p-2 rounded-md border border-neutral-700"
                onClick={() => setHideOutputSecret((v) => !v)}
              >
                {hideOutputSecret ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 110-10 5 5 0 010 10z"/>
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M2 12s3 7 10 7c2.2 0 4.1-.6 5.7-1.5l2.8 2.8 1.4-1.4L4.4 3.4 3 4.8l3.1 3.1C4.4 9.2 3 11.1 2 12zm9.9-5c.1 0 .1 0 0 0l6.1 6.1c1.2-1.3 2-2.7 2-2.7s-3-7-10-7c-.6 0-1.2 0-1.7.1l1.7 1.6c.6-.1 1.2-.1 1.9-.1z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-400">Address</div>
            <div className="break-all rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">{address}</div>
          </div>
        </div>
      )}
    </div>
  );
}
