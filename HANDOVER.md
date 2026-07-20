# Subregistry Lab: Session Handover

Context file so work can continue in a fresh session without re-deriving anything.
Last updated: 2026-07-20. Facts verified against `ensdomains/contracts-v2` main (clone at `/tmp/contracts-v2-main`, may need re-cloning).

## What this app is

Browser playground for experimenting with ENSv2 subregistry setups on Sepolia, built for a non-coding coworker. Wizard flow: connect wallet → pick owned .eth name → inspect current setup (Adopt vs Replace) → choose preset → review + diagram → transaction stepper → playground (register subnames, records, resolve checks, live diagram) → optional irreversible lock. Automates the docs' "For Contract Developers" tutorial.

- **Repo**: https://github.com/wentelteefje/subregistry-lab (branch `main`, HTTPS remote; owner's SSH/GPG keys live on a YubiKey, so tool-driven commits use `git -c commit.gpgsign=false commit ...` — this is deliberate and approved).
- **Hosting**: Netlify, auto-deploys on every push to `main`. `netlify.toml` carries build config (`npm run build` → `dist`), Node 22 pin, SPA redirect, and a hardened CSP (fonts are bundled locally; no external font hosts).
- **Dev**: `npm run dev`; tests `npx vitest run` (81 passing); build `npm run build` (tsc + vite).
- Kevin commits the docs repo himself; committing THIS repo directly is fine and has been the norm.

## Architecture

- `src/lib/` — pure, unit-tested logic. `roles.ts` (role constants, compose/decompose bitmaps, ROLE_CATALOG with tooltip copy), `presets.ts` (three presets + DANGEROUS_ROOT_BITMAP + MAX_EXPIRY), `steps.ts` (StepDef transaction plans), `diagramModel.ts` (SetupView → React Flow nodes/edges/affinities), `names.ts` (labelhashId, canonicalId = mask lower 32 version bits, fqdn, namehash, normalize), `salt.ts` (fresh salt per attempt; same-salt CREATE2 redeploy reverts), `logs.ts`, `links.ts`, `errors.ts` (viem error → kind/message/hint).
- `src/hooks/` — `useTxSequence` (the runner: per step skipIf → pre-verify idempotence auto-skip → simulate → wallet → mine → onReceipt ctx patch → verify read-back; resumable; only userRegistry/resolver/registrar patches persist to the session), `useOwnedNames` (chunked log scan + cache), `useNameStatus` (parent's live expiry/subregistry/resolver/roles), `useRegistryState` (subnames from LabelRegistered logs + getState + getResolver per label), `useRegistrarDiscovery` (EACRolesChanged → contract holding ROLE_REGISTRAR), `useDeployedRegistries` (ProxyDeployed by sender), `useUsdc`.
- `src/state/labSession.ts` — sessions keyed `wallet:parentLabel`, localStorage, bigint-safe. Chain state is never trusted from the session: playground gating checks the live subregistry pointer matches the session registry.
- `src/diagram/` — read-only React Flow diagram, ENS Diagram System "protocol" style (lapis graph paper, 8px/80px grid). `ConfigDiagram` handles top-left fit (onInit → fitView then re-anchor viewport), hover highlighting, and click-to-inspect.
- `src/components/` — wizard panels. `PlaygroundPanel` is the biggest; also `ResolverPicker`, `RegistryHistory` (relink old registries), `RoleMatrixEditor`, `LockPanel`, `ReviewPanel` (keyed by presetId), `TxStepper`, `ui.tsx` (ENS-Explorer-style chips/cards/badges).

## Deployed contract set (sepolia-official-v1-20260525-r2, in `src/config/deployments.ts`)

- ETHRegistry `0xDEDB92913A25abE1f7BCDD85D8A344a43B398B67` (deploy block 10921984)
- VerifiableFactory `0xD2a632D8a8b67c2c4398c255CbD7aF8dd7236198`
- UserRegistryImpl `0x0F99e7Ea74903AfCB7224d0354fD7428A6f92917`
- PermissionedResolverImpl `0xdcE5205A553573FFd47629327DDdf36186022FfA`
- MockUSDC (open `mint(address,uint256)`), UniversalResolverV2 for resolve checks.

**Deployed-impl quirks (they predate current main):**
- NO `getOwner` view — use `getState(anyId).latestOwner` everywhere.
- PermissionedResolver uses the 2-arg `initialize(admin, roleBitmap)` (pre-PR-#336).
- Deployment artifacts are the ABI source of truth, NOT current main. ABIs are pinned in `src/config/abis.ts`; a generate-time address guard exists in the docs repo's deployments mechanism.
- `getAlias`/`setAlias` DO exist on the deployed resolver impl (verified live 2026-07-15).
- Registry/resolver deploys all go through `VerifiableFactory.deployProxy` (verifiable via `verifyContract`). The SimpleSubnameRegistrar is deliberately a direct bytecode deploy (constructor args, not initializable) — artifact bundled at `src/config/artifacts/SimpleSubnameRegistrar.json`.

## RPC constraints (hard-won)

- Full-range `getLogs` works on `https://sepolia.gateway.tenderly.co` (CORS *). Used as `LOG_SCAN_RPC` with the wagmi transport as fallback.
- drpc free tier caps `getLogs` at 10000 blocks; publicnode 403s historical getLogs ("Archive requests"). `classifyError` knows these shapes as kind `rpc-range`.

## Key design decisions and their rationale

1. **Shared resolver = the parent name's live resolver on the ETHRegistry** (`nameStatus.resolver`), NOT the session's stored resolver. The session value drifts across replace/relink cycles (bug found live: subnames showed "own resolver" although the app itself had set them). The setup sequence keeps the definition true via the `set-parent-resolver` step (ETHRegistry.setResolver after link; skipped when the setup has no resolver; auto-skips when already correct).
2. **Resolver-less subnames are served by the shared resolver.** Verified in contracts-v2 `LibRegistry.findResolver`: walking root→leaf, the resolver is only overwritten when a label's own pointer is non-zero, so the nearest ancestor resolver wins (wildcard-style). Consequences implemented: hover affinities relate the shared resolver to parent + all non-foreign subnames; inspector "serves" list includes fallback subnames; "set my address" is offered for resolver-less subnames (records keyed by namehash on the shared resolver work via fallback).
3. **Foreign resolver visualization** (`classifyResolver`: none/default/foreign, case-insensitive, zero=none): per-distinct-address nodes at `COL.farRight=1060` (clear of long subname labels), min 120px vertical gap (boxes ~90px tall vs 60px sub rows), capped at `MAX_FOREIGN_RESOLVER_NODES=4` with a `+N more` overflow node (distinct-addr Set). Aggregate registry→resolver edge relabels to "default records" when any subname deviates. `∅` marker = no own pointer (falls back to shared). Only the FIRST edge into each foreign node carries the "records" label (converging labels overlapped). Foreign nodes render light (no corner sockets); the shared one dark.
4. **Hover highlighting**: edge adjacency ∪ `DiagramState.affinities` (semantic relations with no drawn edge). Dimmed edges also get a dimmed `labelStyle` (React Flow's edge `style.opacity` does not affect labels — shared `EDGE_LABEL_STYLE` constant).
5. **Roles**: registry roles user-tier lower 128 bits, admin = `<<128`; ROOT_RESOURCE roles OR into every check (master key); admin alone can self-grant (two-step) but not execute; ROLE_CAN_TRANSFER_ADMIN admin-only; roles move with token on transfer. `SUBNAME_OWNER_BITMAP === REGISTRATION_ROLE_BITMAP` (golden hex `0x1110000000000000000000000000000001100000`). Resolver roles are a SEPARATE namespace (PermissionedResolverLib): SET_ADDR 1<<0, SET_TEXT 1<<4, ..., SET_ALIAS 1<<28 (root-only, no per-name delegation for aliases).
6. **Presets are workflows, not on-chain configurations**: fully-controlled vs unruggable deploy identically; they differ in subname role defaults (minimal = soulbound), expiry default (`max` → "never expires" pre-ticked via `foreverOverride ?? preset default`), and the lock plan. Lock = revoke DANGEROUS_ROOT_BITMAP from self on the UserRegistry + optional parent-link lock via `revokeRoles(resource, SET_SUBREGISTRY|admin)` using the PRE-READ resource (never the canonical id).

## Live test state on Sepolia (Kevin's wallet `0x2Ad4…e32D`, parent `mycoolnewname.eth`)

- Currently linked registry `0xb8BA…889a` (Jul 12) with registrar `0x8813…1246` (5 USDC/yr) and that setup's resolver `0x7325…81f3`.
- Parent's resolver on ETHRegistry: `0x5e84…A5Fb` (June 8 deploy) — so the trio kevin1/leo/validator (pointing at `0x7325`) show "own resolver" badges, which is now the honest reading. alice points at `0x5e84` (default).
- Other registries deployed by the wallet: `0x0bC1…5eA3` (Jun 9), `0xe421…0d43` (Jun 11, tutorial-era), `0x72C1…a00e` (Jul 13, unlinked test).
- explorer.ens.dev indexer was ~40k blocks behind (known issue, not our bug); name pages mix live reads with index data.

## NEXT FEATURE (planned, approved direction, NOT yet built): record aliasing

Mechanics verified against contracts-v2 main + deployed impl (supports it; owner holds ROLE_SET_ALIAS via ALL_ROLES init):

- `setAlias(bytes fromName, bytes toName)` — DNS-encoded names, root-only role, empty toName clears, emits `AliasChanged(indexed hashed, indexed hashed, plain fromName, plain toName)`.
- `resolve()` applies `getAlias()` longest-suffix match recursively, rewrites the node in profile calldata → records read at TARGET node; source's own records ignored while aliased. Internal to the one resolver contract. Suffix matching remaps sub-subnames too. Self-alias applies once; cycles ≥2 = OOG (resolution breaks) → UI must prevent.

Plan (scope rule: endpoints only names the shared resolver serves, i.e. parent + non-foreign subnames; foreign excluded both ends):
1. `src/lib/dns.ts`: DNS-encode via viem `packetToBytes` + a decoder; tests.
2. `wouldCreateCycle(aliasMap, from, to)` helper; tests.
3. `buildSetAliasSteps` / clear variant (single step, verify via `getAlias` read-back; runner idempotence free).
4. `useResolverAliases(resolver)` hook: AliasChanged full-range scan (tenderly path), dedupe sources, live `getAlias` confirm, keep names under parent.
5. UI: one "alias…" action per eligible subname row → inline target picker (other eligible subs + parent, cycle-creating targets filtered) + "clear alias"; aliased rows get `alias → x` badge and LOSE "set my address" (writes would be invisible); resolve check stays (best demo).
6. Diagram: dashed source→target edge labeled "alias" (same lapis ink), hover affinity between the pair.
7. Gate on live `roles(0, account) & (1<<28)` on the resolver, not ownership assumption.
Out of scope: free-text external targets, nested-subname demos, per-record authorization UI.

## Other offered-but-not-requested ideas

- "Authorize records" button (per-subname-owner `authorizeNameRoles`/`authorizeTextRoles` delegation on the shared resolver).
- Real avatar fetch with gradient fallback (AvatarSquare currently always gradient).
- Point "set my address" at the sub's OWN resolver when the connected user owns it (currently the button targets the shared resolver and is hidden for foreign subnames).
- Report explorer indexer lag + name-page/registry-page inconsistency to the explorer team.

## Testing conventions

Vitest, pure-lib only (no component tests). Step tests build plans and assert action shape + verify with stubbed `read` callbacks. Diagram tests assert node/edge ids, labels, positions (layout regressions), affinities, determinism (JSON.stringify equality). When adding features: logic in `src/lib` first with tests, then hooks/UI. Run `npx vitest run && npm run build` before committing; commit messages explain the why; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
