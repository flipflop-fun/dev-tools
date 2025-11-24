import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

export default function PDATool() {
  const [programId, setProgramId] = useState("");
  const [seed1, setSeed1] = useState("");
  const [seed2, setSeed2] = useState("");
  const [seed3, setSeed3] = useState("");
  const [seed4, setSeed4] = useState("");
  const [pda, setPda] = useState<string>("");
  const [bump, setBump] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  const onDerive = () => {
    setError("");
    setPda("");
    setBump(null);
    try {
      const pid = new PublicKey(programId.trim());
      const seeds = [seed1, seed2, seed3, seed4]
        .map((s) => Buffer.from(s))
        .filter((b) => b.length > 0);
      const [addr, bumpVal] = PublicKey.findProgramAddressSync(seeds, pid);
      setPda(addr.toBase58());
      setBump(bumpVal);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">PDA Derivation</h2>
      <div className="grid gap-3">
        <input
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          placeholder="Program ID (base58)"
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          placeholder="Seed 1 (text)"
          value={seed1}
          onChange={(e) => setSeed1(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          placeholder="Seed 2"
          value={seed2}
          onChange={(e) => setSeed2(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          placeholder="Seed 3"
          value={seed3}
          onChange={(e) => setSeed3(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          placeholder="Seed 4"
          value={seed4}
          onChange={(e) => setSeed4(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button
          className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
          onClick={onDerive}
        >
          Derive Address
        </button>
        <button
          className="px-3 py-2 rounded-md border border-neutral-700 text-sm"
          onClick={() => {
            setProgramId("");
            setSeed1("");
            setSeed2("");
            setSeed3("");
            setSeed4("");
            setPda("");
            setBump(null);
            setError("");
          }}
        >
          Clear
        </button>
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {!!pda && (
        <div className="space-y-2">
          <div>
            <div className="text-xs text-neutral-400">PDA</div>
            <div className="break-all rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">{pda}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-400">Bump</div>
            <div className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">{bump}</div>
          </div>
        </div>
      )}
    </div>
  );
}
