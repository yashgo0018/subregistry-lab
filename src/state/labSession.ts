/**
 * Lab session state: everything the app must remember across refreshes that
 * is NOT readable from the chain (which name is being worked on, addresses
 * this app deployed, tx progress). Chain state itself always comes from
 * wagmi reads; on-chain truth wins over anything stored here.
 *
 * Sessions are keyed per wallet+parentLabel so switching names never
 * clobbers a previous experiment.
 */

import type { Address } from "viem";
import type { PresetId } from "../lib/presets";

export type StepStatus =
  | "queued"
  | "wallet"
  | "mining"
  | "verifying"
  | "done"
  | "skipped"
  | "failed";

export type StepState = {
  status: StepStatus;
  txHash?: `0x${string}`;
  detail?: string;
  errorKind?: string;
};

export type SessionData = {
  wallet: string;
  parentLabel: string;
  presetId?: PresetId;
  deployResolver: boolean;
  /** Custom subname-owner role bitmap (overrides the preset default), as string. */
  subnameRoleBitmap?: string;
  registrarParams?: {
    pricePerYear: string; // bigints as strings for JSON round-tripping
    minDuration: string;
    beneficiary: Address;
  };
  addresses: {
    userRegistry?: Address;
    resolver?: Address;
    registrar?: Address;
  };
  /** Block of the registry deploy tx, for cheap subname log scans. */
  registryDeployBlock?: string;
  /** sequenceId -> stepId -> state */
  sequences: Record<string, Record<string, StepState>>;
  locked: { registryLocked?: boolean; linkLocked?: boolean };
};

export type LabState = {
  activeKey?: string;
  sessions: Record<string, SessionData>;
};

export function sessionKey(wallet: string, parentLabel: string): string {
  return `${wallet.toLowerCase()}:${parentLabel.toLowerCase()}`;
}

export function newSession(wallet: string, parentLabel: string): SessionData {
  return {
    wallet: wallet.toLowerCase(),
    parentLabel: parentLabel.toLowerCase(),
    deployResolver: true,
    addresses: {},
    sequences: {},
    locked: {},
  };
}

export type LabAction =
  | { type: "select-name"; wallet: string; parentLabel: string }
  | { type: "set-preset"; presetId: PresetId }
  | { type: "set-deploy-resolver"; value: boolean }
  | { type: "set-subname-bitmap"; bitmap?: bigint }
  | {
      type: "set-registrar-params";
      params?: { pricePerYear: bigint; minDuration: bigint; beneficiary: Address };
    }
  | { type: "patch-addresses"; patch: Partial<SessionData["addresses"]> }
  | { type: "set-registry-deploy-block"; block: bigint }
  | { type: "step-state"; sequenceId: string; stepId: string; state: StepState }
  | { type: "reset-sequence"; sequenceId: string }
  | { type: "reset-setup" }
  | { type: "set-locked"; patch: Partial<SessionData["locked"]> }
  | { type: "reset-session" }
  | { type: "deselect" };

function withActive(
  state: LabState,
  update: (session: SessionData) => SessionData,
): LabState {
  if (!state.activeKey) return state;
  const current = state.sessions[state.activeKey];
  if (!current) return state;
  return {
    ...state,
    sessions: { ...state.sessions, [state.activeKey]: update(current) },
  };
}

export function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case "select-name": {
      const key = sessionKey(action.wallet, action.parentLabel);
      return {
        activeKey: key,
        sessions: {
          ...state.sessions,
          [key]: state.sessions[key] ?? newSession(action.wallet, action.parentLabel),
        },
      };
    }
    case "deselect":
      return { ...state, activeKey: undefined };
    case "set-preset":
      return withActive(state, (s) => ({ ...s, presetId: action.presetId }));
    case "set-deploy-resolver":
      return withActive(state, (s) => ({ ...s, deployResolver: action.value }));
    case "set-subname-bitmap":
      return withActive(state, (s) => ({
        ...s,
        subnameRoleBitmap: action.bitmap?.toString(),
      }));
    case "set-registrar-params":
      return withActive(state, (s) => ({
        ...s,
        registrarParams: action.params
          ? {
              pricePerYear: action.params.pricePerYear.toString(),
              minDuration: action.params.minDuration.toString(),
              beneficiary: action.params.beneficiary,
            }
          : undefined,
      }));
    case "patch-addresses":
      return withActive(state, (s) => ({
        ...s,
        addresses: { ...s.addresses, ...action.patch },
      }));
    case "set-registry-deploy-block":
      return withActive(state, (s) => ({
        ...s,
        registryDeployBlock: action.block.toString(),
      }));
    case "step-state":
      return withActive(state, (s) => ({
        ...s,
        sequences: {
          ...s.sequences,
          [action.sequenceId]: {
            ...s.sequences[action.sequenceId],
            [action.stepId]: action.state,
          },
        },
      }));
    case "reset-sequence":
      return withActive(state, (s) => {
        const sequences = { ...s.sequences };
        delete sequences[action.sequenceId];
        return { ...s, sequences };
      });
    case "reset-setup":
      // Fresh reconfiguration: forget the previous run's steps, the deployed
      // registry/registrar, and any custom role bitmap (the new preset's
      // default applies). The resolver choice is per-account and survives;
      // linkLocked refers to the parent name, not the registry.
      return withActive(state, (s) => {
        const sequences = { ...s.sequences };
        delete sequences["setup"];
        return {
          ...s,
          sequences,
          addresses: { resolver: s.addresses.resolver },
          registryDeployBlock: undefined,
          subnameRoleBitmap: undefined,
          locked: { ...s.locked, registryLocked: undefined },
        };
      });
    case "set-locked":
      return withActive(state, (s) => ({ ...s, locked: { ...s.locked, ...action.patch } }));
    case "reset-session":
      return withActive(state, (s) => newSession(s.wallet, s.parentLabel));
    default:
      return state;
  }
}

const STORAGE_KEY = "subregistry-lab:sessions:v1";

export function loadState(): LabState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LabState;
  } catch {
    // corrupt storage: start fresh
  }
  return { sessions: {} };
}

export function saveState(state: LabState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full/unavailable: session just won't persist
  }
}
