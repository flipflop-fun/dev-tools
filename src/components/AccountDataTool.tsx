import { useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";

type Idl = {
  accounts?: Array<{
    name: string;
    type?:
      | { kind: "struct"; fields: Array<{ name: string; type: IdlType }> }
      | { defined: string };
  }>;
  types?: Array<{
    name: string;
    type:
      | { kind: "struct"; fields: Array<{ name: string; type: IdlType }> }
      | { kind: "enum"; variants: Array<IdlEnumVariant> };
  }>;
};

type IdlEnumVariant = {
  name: string;
  fields?:
    | Array<{ name: string; type: IdlType }>
    | Array<IdlType>
    | { kind: "struct"; fields: Array<{ name: string; type: IdlType }> }
    | { kind: "tuple"; types: Array<IdlType> };
};

type IdlType =
  | "u8"
  | "i8"
  | "u16"
  | "i16"
  | "u32"
  | "i32"
  | "u64"
  | "i64"
  | "bool"
  | "string"
  | "publicKey"
  | "bytes"
  | { vec: IdlType }
  | { option: IdlType }
  | { array: [IdlType, number] }
  | { defined: string };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function chunkedHex(bytes: Uint8Array, chunk = 16): string {
  const hex = toHex(bytes);
  const out: string[] = [];
  for (let i = 0; i < hex.length; i += chunk * 2) {
    out.push(hex.slice(i, i + chunk * 2));
  }
  return out.join(" ");
}

async function sha256(input: BufferSource): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(digest);
}

async function anchorDiscriminatorForAccount(name: string): Promise<Uint8Array> {
  const prefix = new TextEncoder().encode("account:");
  const n = new TextEncoder().encode(name);
  const data = new Uint8Array(prefix.length + n.length);
  data.set(prefix);
  data.set(n, prefix.length);
  const hash = await sha256(data);
  return hash.slice(0, 8);
}

function readU8(view: DataView, offset: number): [number, number] {
  return [view.getUint8(offset), offset + 1];
}
function readI8(view: DataView, offset: number): [number, number] {
  return [view.getInt8(offset), offset + 1];
}
function readU16(view: DataView, offset: number): [number, number] {
  return [view.getUint16(offset, true), offset + 2];
}
function readI16(view: DataView, offset: number): [number, number] {
  return [view.getInt16(offset, true), offset + 2];
}
function readU32(view: DataView, offset: number): [number, number] {
  return [view.getUint32(offset, true), offset + 4];
}
function readI32(view: DataView, offset: number): [number, number] {
  return [view.getInt32(offset, true), offset + 4];
}
function readU64(view: DataView, offset: number): [bigint, number] {
  return [view.getBigUint64(offset, true), offset + 8];
}
function readI64(view: DataView, offset: number): [bigint, number] {
  return [view.getBigInt64(offset, true), offset + 8];
}

function readBool(view: DataView, offset: number): [boolean, number] {
  const [v, n] = readU8(view, offset);
  return [v !== 0, n];
}

function readString(view: DataView, bytes: Uint8Array, offset: number): [string, number] {
  const [len, no] = readU32(view, offset);
  const slice = bytes.slice(no, no + len);
  const s = new TextDecoder().decode(slice);
  return [s, no + len];
}

function readVec(view: DataView, bytes: Uint8Array, offset: number, elem: IdlType, idl: Idl): [unknown[], number] {
  const [len, no] = readU32(view, offset);
  const out: unknown[] = [];
  let off = no;
  for (let i = 0; i < len; i++) {
    const [v, n] = decodeType(view, bytes, off, elem, idl);
    out.push(v);
    off = n;
  }
  return [out, off];
}

function readArray(view: DataView, bytes: Uint8Array, offset: number, elem: IdlType, count: number, idl: Idl): [unknown[], number] {
  const out: unknown[] = [];
  let off = offset;
  for (let i = 0; i < count; i++) {
    const [v, n] = decodeType(view, bytes, off, elem, idl);
    out.push(v);
    off = n;
  }
  return [out, off];
}

function resolveDefined(idl: Idl, name: string):
  | { kind: "struct"; fields: Array<{ name: string; type: IdlType }> }
  | { kind: "enum"; variants: Array<IdlEnumVariant> }
  | null {
  const def = idl.types?.find((t) => t.name === name);
  return def ? def.type : null;
}

function isStructFields(x: IdlEnumVariant["fields"]): x is { kind: "struct"; fields: Array<{ name: string; type: IdlType }> } {
  return !!x && !Array.isArray(x) && (x as { kind?: string }).kind === "struct";
}

function isTupleFields(x: IdlEnumVariant["fields"]): x is { kind: "tuple"; types: Array<IdlType> } {
  return !!x && !Array.isArray(x) && (x as { kind?: string }).kind === "tuple";
}

function isStructType(x: NonNullable<ReturnType<typeof resolveDefined>>): x is { kind: "struct"; fields: Array<{ name: string; type: IdlType }> } {
  return !!x && (x as { kind?: string }).kind === "struct";
}

function isEnumType(x: NonNullable<ReturnType<typeof resolveDefined>>): x is { kind: "enum"; variants: Array<IdlEnumVariant> } {
  return !!x && (x as { kind?: string }).kind === "enum";
}

function decodeEnum(view: DataView, bytes: Uint8Array, offset: number, variants: Array<IdlEnumVariant>, idl: Idl): [unknown, number] {
  const [tag, no] = readU8(view, offset);
  const variant = variants[tag];
  if (!variant) return [{ tag, name: "Unknown" }, no];

  const fields = variant.fields;
  if (!fields) return [{ tag, name: variant.name }, no];

  let off = no;
  let value: unknown;
  if (Array.isArray(fields)) {
    if (fields.length > 0 && typeof fields[0] === "object" && !("vec" in fields[0]) && !("option" in fields[0]) && !("array" in fields[0]) && !("defined" in fields[0])) {
      const obj: Record<string, unknown> = {};
      for (const f of fields as Array<{ name: string; type: IdlType }>) {
        const [v, n] = decodeType(view, bytes, off, f.type, idl);
        obj[f.name] = v;
        off = n;
      }
      value = obj;
    } else {
      const arr: unknown[] = [];
      for (const t of fields as Array<IdlType>) {
        const [v, n] = decodeType(view, bytes, off, t, idl);
        arr.push(v);
        off = n;
      }
      value = arr;
    }
  } else if (typeof fields === "object") {
    if (isStructFields(fields)) {
      const obj: Record<string, unknown> = {};
      for (const f of fields.fields as Array<{ name: string; type: IdlType }>) {
        const [v, n] = decodeType(view, bytes, off, f.type, idl);
        obj[f.name] = v;
        off = n;
      }
      value = obj;
    } else if (isTupleFields(fields)) {
      const arr: unknown[] = [];
      for (const t of fields.types as Array<IdlType>) {
        const [v, n] = decodeType(view, bytes, off, t, idl);
        arr.push(v);
        off = n;
      }
      value = arr;
    } else {
      value = {};
    }
  }
  return [{ tag, name: variant.name, value }, off];
}

function decodeStruct(view: DataView, bytes: Uint8Array, offset: number, fields: Array<{ name: string; type: IdlType }>, idl: Idl): [Record<string, unknown>, number] {
  const obj: Record<string, unknown> = {};
  let off = offset;
  for (const f of fields) {
    const [v, n] = decodeType(view, bytes, off, f.type, idl);
    obj[f.name] = v;
    off = n;
  }
  return [obj, off];
}

function decodeType(view: DataView, bytes: Uint8Array, offset: number, type: IdlType, idl: Idl): [unknown, number] {
  if (typeof type === "string") {
    switch (type) {
      case "u8": return readU8(view, offset);
      case "i8": return readI8(view, offset);
      case "u16": return readU16(view, offset);
      case "i16": return readI16(view, offset);
      case "u32": return readU32(view, offset);
      case "i32": return readI32(view, offset);
      case "u64": { const [v, n] = readU64(view, offset); return [v.toString(), n]; }
      case "i64": { const [v, n] = readI64(view, offset); return [v.toString(), n]; }
      case "bool": return readBool(view, offset);
      case "string": return readString(view, bytes, offset);
      case "publicKey": {
        const slice = bytes.slice(offset, offset + 32);
        const pk = new PublicKey(slice);
        return [pk.toBase58(), offset + 32];
      }
      case "bytes": {
        const [arr, n] = readVec(view, bytes, offset, "u8", idl);
        return ["0x" + toHex(Uint8Array.from(arr as number[])), n];
      }
      default:
        return [null, offset];
    }
  }
  if ("vec" in type) {
    return readVec(view, bytes, offset, type.vec, idl);
  }
  if ("option" in type) {
    const [has, no] = readU8(view, offset);
    if (has === 0) return [null, no];
    return decodeType(view, bytes, no, type.option, idl);
  }
  if ("array" in type) {
    return readArray(view, bytes, offset, type.array[0], type.array[1], idl);
  }
  if ("defined" in type) {
    const def = resolveDefined(idl, type.defined);
    if (!def) return [null, offset];
    if (isStructType(def)) {
      return decodeStruct(view, bytes, offset, def.fields, idl);
    }
    if (isEnumType(def)) {
      return decodeEnum(view, bytes, offset, def.variants, idl);
    }
  }
  return [null, offset];
}

async function parseAccountWithIdl(bytes: Uint8Array, idl: Idl): Promise<{ accountName: string; data: Record<string, unknown> } | null> {
  if (!idl.accounts || idl.accounts.length === 0) return null;
  const disc = bytes.slice(0, 8);
  for (const acc of idl.accounts) {
    const d = await anchorDiscriminatorForAccount(acc.name);
    if (Array.from(d).every((v, i) => v === disc[i])) {
      const body = bytes.slice(8);
      const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
      const fields = getAccountStructFields(idl, acc.name);
      if (!fields) continue;
      const [obj] = decodeStruct(view, body, 0, fields, idl);
      return { accountName: acc.name, data: obj };
    }
  }
  return null;
}

export default function AccountDataTool() {
  const [address, setAddress] = useState("");
  const [idlText, setIdlText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ lamports: number; owner: string; executable: boolean; rentEpoch: number | null } | null>(null);
  const [raw, setRaw] = useState<{ base64: string; hex: string; bytes: string } | null>(null);
  const [parsed, setParsed] = useState<{ accountName: string; data: Record<string, unknown> } | null>(null);
  const [cluster, setCluster] = useState<"mainnet" | "devnet" | "local">("mainnet");
  const [customRpc, setCustomRpc] = useState("");
  const [selectedIdlAccountName, setSelectedIdlAccountName] = useState<string>("");

  const onFetch = async () => {
    setError("");
    setMeta(null);
    setRaw(null);
    setParsed(null);
    setLoading(true);
    try {
      const pubkey = new PublicKey(address.trim());
      const endpoint = customRpc.trim() || endpointForCluster(cluster);
      const conn = new Connection(endpoint, "confirmed");
      const info = await conn.getAccountInfo(pubkey, "confirmed");
      if (!info) {
        setError("Account not found on selected network");
        setLoading(false);
        return;
      }
      const data = new Uint8Array(info.data as unknown as ArrayBuffer | Uint8Array);
      const base64 = toBase64(data);
      const hex = chunkedHex(data, 16);
      const bytesText = "[" + Array.from(data).join(",") + "]";
      setMeta({ lamports: info.lamports, owner: info.owner.toBase58(), executable: info.executable, rentEpoch: info.rentEpoch ?? null });
      setRaw({ base64, hex: "0x" + hex, bytes: bytesText });

      const trimmed = idlText.trim();
      if (trimmed) {
        try {
          const idl: Idl = JSON.parse(trimmed);
          const result = await parseAccountAutoOrSelected(data, idl, selectedIdlAccountName || undefined);
          if (result) {
            setParsed(result);
          } else {
            setError((prev) => (prev ? prev + "; " : "") + "IDL account type not matched");
          }
        } catch (e: unknown) {
          setError((e instanceof Error ? e.message : String(e)) || "Failed to parse IDL");
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Account Data Viewer</h2>
      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-400">Network</label>
          <select
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            value={cluster}
            onChange={(e) => setCluster(e.target.value as typeof cluster)}
          >
            <option value="mainnet">Mainnet Beta</option>
            <option value="devnet">Devnet</option>
            <option value="local">Local</option>
          </select>
        </div>
        <input
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          placeholder="Optional RPC URL override"
          value={customRpc}
          onChange={(e) => setCustomRpc(e.target.value)}
        />
        {!!idlText.trim() && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-400">IDL Account Type</label>
            <select
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              value={selectedIdlAccountName}
              onChange={(e) => setSelectedIdlAccountName(e.target.value)}
            >
              <option value="">Auto detect</option>
              {safeIdlAccountNames(idlText).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}
        <input
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          placeholder="Account Address (base58)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <textarea
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500 min-h-[120px]"
          placeholder="Optional: Anchor IDL JSON for parsing account data"
          value={idlText}
          onChange={(e) => setIdlText(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button
          className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
          onClick={onFetch}
          disabled={loading}
        >
          {loading ? "Loading..." : "Fetch"}
        </button>
        <button
          className="px-3 py-2 rounded-md border border-neutral-700 text-sm"
          onClick={() => {
            setAddress("");
            setIdlText("");
            setError("");
            setMeta(null);
            setRaw(null);
            setParsed(null);
          }}
        >
          Clear
        </button>
      </div>
      {error && <div className="text-red-400 text-sm break-words">{error}</div>}

      {meta && (
        <div className="space-y-2">
          <div className="text-xs text-neutral-400">Account Metadata</div>
          <div className="grid gap-2">
            <div className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">Lamports: {meta.lamports}</div>
            <div className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm break-all">Owner: {meta.owner}</div>
            <div className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">Executable: {String(meta.executable)}</div>
            <div className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">Rent Epoch: {meta.rentEpoch ?? "-"}</div>
          </div>
        </div>
      )}

      {raw && (
        <div className="space-y-2">
          <div className="text-xs text-neutral-400">Raw Data (readable without IDL)</div>
          <div>
            <div className="text-xs text-neutral-500">Base64</div>
            <div className="break-all rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">{raw.base64}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Hex</div>
            <div className="break-all rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">{raw.hex}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Bytes</div>
            <div className="break-words rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">{raw.bytes}</div>
          </div>
        </div>
      )}

      {parsed && (
        <div className="space-y-2">
          <div className="text-xs text-neutral-400">IDL Parse</div>
          <div className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">
            <div className="text-xs text-neutral-500">Account Type</div>
            <div className="mb-2">{parsed.accountName}</div>
            <div className="text-xs text-neutral-500">Data</div>
            <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(parsed.data, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function endpointForCluster(c: "mainnet" | "devnet" | "local"): string {
  if (c === "devnet") return "https://api.devnet.solana.com";
  if (c === "local") return "http://127.0.0.1:8899";
  return "https://api.mainnet-beta.solana.com";
}

function safeIdlAccountNames(idlText: string): string[] {
  const t = idlText.trim();
  if (!t) return [];
  try {
    const idl: Idl = JSON.parse(t);
    return (idl.accounts ?? []).map((a) => a.name);
  } catch {
    return [];
  }
}

async function parseAccountAutoOrSelected(bytes: Uint8Array, idl: Idl, selected?: string): Promise<{ accountName: string; data: Record<string, unknown> } | null> {
  if (selected) {
    const acc = idl.accounts?.find((a) => a.name === selected);
    if (!acc) return null;
    const hasDisc = bytes.length >= 8;
    let useOffset = 0;
    if (hasDisc) {
      const d = await anchorDiscriminatorForAccount(acc.name);
      const match = Array.from(d).every((v, i) => v === bytes[i]);
      useOffset = match ? 8 : 0;
    }
    const body = bytes.slice(useOffset);
    const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
    const fields = getAccountStructFields(idl, acc.name);
    if (!fields) return null;
    const [obj] = decodeStruct(view, body, 0, fields, idl);
    return { accountName: acc.name, data: obj };
  }
  return parseAccountWithIdl(bytes, idl);
}

function getAccountStructFields(idl: Idl, name: string): Array<{ name: string; type: IdlType }> | null {
  const acc = idl.accounts?.find((a) => a.name === name);
  if (acc && acc.type && hasAccountStruct(acc.type)) {
    return acc.type.fields;
  }
  if (acc && acc.type && hasAccountDefined(acc.type)) {
    const def = resolveDefined(idl, acc.type.defined);
    if (def && isStructType(def)) return def.fields;
  }
  const fromTypes = idl.types?.find((t) => t.name === name);
  if (fromTypes && isStructType(fromTypes.type)) return fromTypes.type.fields;
  return null;
}

type AccountType = { kind: "struct"; fields: Array<{ name: string; type: IdlType }> } | { defined: string };

function hasAccountStruct(x: AccountType): x is { kind: "struct"; fields: Array<{ name: string; type: IdlType }> } {
  return ((x as { kind?: string }).kind === "struct");
}

function hasAccountDefined(x: AccountType): x is { defined: string } {
  return ((x as { defined?: string }).defined !== undefined);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}
