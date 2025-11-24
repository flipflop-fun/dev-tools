# Dev Tools

Lightweight Solana developer toolbox built with React, TypeScript, Vite, and Tailwind CSS. The app focuses on simple, fast, and safe local conversions commonly needed during Solana development.

## Features
- Array Private Key → Base58 & Address
  - Input a Solana secret key as an array of bytes (32 or 64).
  - Outputs the base58-encoded secret key and the public address.

- Base58 → Array Private Key & Address
  - Input a base58-encoded secret key (32 or 64 bytes).
  - Outputs the array form of the secret key and the derived public address.

- PDA Derivation
  - Input a `programId` and up to four seed strings.
  - Seeds are combined with `Buffer.from(...)` and passed to `PublicKey.findProgramAddressSync`.

Example:

```ts
import { PublicKey } from '@solana/web3.js'

export function pdaMint(programId: PublicKey, name: string, symbol: string) {
  const seed = Buffer.from('fair_mint')
  return PublicKey.findProgramAddressSync(
    [seed, Buffer.from(name), Buffer.from(symbol.toLowerCase())],
    programId,
  )
}
```

## Quick Start

```bash
npm install
npm run dev
```

## Build & Preview

```bash
npm run build
npm run preview
```

## Files of Interest
- `src/components/SecretKeyTool.tsx` — Array → Base58 & Address
- `src/components/Base58SecretTool.tsx` — Base58 → Array & Address
- `src/components/PDATool.tsx` — PDA derivation (up to 4 seeds)
- `src/App.tsx` — Page layout and sections

## Tech Stack
- React, TypeScript, Vite
- Tailwind CSS v4 via `@tailwindcss/postcss`
- `@solana/web3.js`, `bs58`, `buffer`

## Security Note
All conversions run locally in the browser; no backend calls are made. Treat private keys carefully and avoid using production secrets on untrusted machines.
