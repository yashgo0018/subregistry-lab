# ENSv2 Subregistry Lab

A browser playground for experimenting with **ENSv2 subname registry setups on Sepolia**, no coding required. It automates the steps from the ENSv2 ["For Contract Developers"](https://docs.ens.domains/contracts/ensv2/tutorial-contract-developers) guide behind a wallet UI.

## What you can do

1. **Connect** a wallet (Sepolia).
2. **Pick a .eth name you own** (auto-detected, with expiry shown).
3. **Choose a configuration:**
   - **Fully controlled**: you keep every permission (default for experimenting).
   - **Standard rentable**: also deploys the guide's SimpleSubnameRegistrar so anyone can register subnames for a fee in test USDC (built-in faucet).
   - **Unruggable, unexpiring**: subnames registered with a never-expiring lifetime and minimal permissions, plus an optional lock step that irreversibly removes your own dangerous roles.
4. **Execute**: the app walks through the transactions one by one (deploy registry → deploy resolver → link name → deploy registrar → grant roles), verifying each result on-chain.
5. **Playground**: register subnames (free as owner, or paid via the registrar), set address records, run live resolve checks, and watch the setup diagram update.
6. **Experiment freely**: re-running the setup replaces the registry linked to your name. Old registries keep their subnames and can be re-adopted later.

Deep links to the [ENS Explorer](https://explorer.ens.dev) and Sepolia Etherscan are everywhere.

## Getting Sepolia prerequisites

- Sepolia ETH for gas: any Sepolia faucet.
- A .eth name on the ENSv2 Sepolia deployment: register one in the [ENS Explorer](https://explorer.ens.dev).
- Test USDC (only for the rentable preset): the app has a mint button.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # vitest unit tests (pure logic: bitmaps, plans, parsing)
npm run build      # type check + production build to dist/
```

Optional `.env` (see `.env.example`): `VITE_WALLETCONNECT_PROJECT_ID` for WalletConnect wallets; injected wallets (MetaMask etc.) work without it.

## Deployment

Static site; `netlify.toml` is included:

```sh
netlify deploy --prod    # or connect the repo in the Netlify UI
```

## Configuration

- **Contract addresses** live in `src/config/deployments.ts`, the ENSv2 Sepolia set from the official `sepolia-official-v1-20260525-r2` deployment (same as docs.ens.domains). Edit there when deployments move.
- The `SimpleSubnameRegistrar` bytecode in `src/config/artifacts/` is the compiled contract from the tutorial (source in `ensv2-example-tests/contracts/`).

## Architecture notes

- `src/lib/` is pure, unit-tested logic: role bitmaps (`roles.ts`), presets (`presets.ts`), transaction plans (`steps.ts`), log-scan helpers (`logs.ts`), diagram model (`diagramModel.ts`).
- `src/hooks/useTxSequence.ts` runs the plans: simulate → wallet → mine → verify (read-back), with resume support after rejections or refreshes.
- Session state (selected name, deployed addresses, progress) persists in localStorage; all chain state is re-read live, on-chain truth wins.
