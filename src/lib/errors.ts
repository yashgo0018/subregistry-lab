/**
 * Turn viem/wallet errors into something a non-coder can act on.
 * Classification is by error name / message substring so it works across
 * viem's nested error causes without importing every error class.
 */

export type ClassifiedError = {
  kind:
    | "user-rejected"
    | "wrong-chain"
    | "unauthorized"
    | "insufficient-allowance"
    | "insufficient-balance"
    | "insufficient-eth"
    | "name-unavailable"
    | "salt-reused"
    | "rpc-range"
    | "unknown";
  message: string;
  hint?: string;
};

type ErrorLike = {
  name?: string;
  message?: string;
  shortMessage?: string;
  details?: string;
  cause?: unknown;
  code?: number;
};

/** Flatten an error and its causes into one searchable string. */
function flatten(err: unknown, depth = 0): string {
  if (err == null || depth > 6) return "";
  const e = err as ErrorLike;
  const parts = [e.name, e.shortMessage, e.message, e.details].filter(Boolean);
  return `${parts.join(" | ")} ${flatten(e.cause, depth + 1)}`;
}

export function classifyError(err: unknown): ClassifiedError {
  const text = flatten(err);
  const e = err as ErrorLike;

  if (
    e.code === 4001 ||
    text.includes("UserRejectedRequestError") ||
    text.includes("User rejected")
  ) {
    return {
      kind: "user-rejected",
      message: "You cancelled the transaction in your wallet.",
      hint: "Nothing was sent. Use Resume to try again.",
    };
  }
  if (text.includes("ChainMismatchError") || text.includes("does not match the target chain")) {
    return {
      kind: "wrong-chain",
      message: "Your wallet is on the wrong network.",
      hint: "Switch to Sepolia and try again.",
    };
  }
  if (text.includes("EACUnauthorizedAccountRoles") || text.includes("EACUnauthorized")) {
    return {
      kind: "unauthorized",
      message: "This wallet doesn't have the required permission for that action.",
      hint: "Make sure the connected wallet owns the name (or was granted the role).",
    };
  }
  if (
    text.includes("ERC20InsufficientAllowance") ||
    text.includes("insufficient allowance")
  ) {
    return {
      kind: "insufficient-allowance",
      message: "The registrar isn't approved to take the payment yet.",
      hint: "Run the approve step first.",
    };
  }
  if (
    text.includes("ERC20InsufficientBalance") ||
    text.includes("transfer amount exceeds balance")
  ) {
    return {
      kind: "insufficient-balance",
      message: "Not enough test USDC in your wallet.",
      hint: "Use the faucet button to mint some.",
    };
  }
  if (text.includes("exceeds the balance of the account") || text.includes("insufficient funds")) {
    return {
      kind: "insufficient-eth",
      message: "Not enough Sepolia ETH to pay for gas.",
      hint: "Get some from a Sepolia faucet.",
    };
  }
  if (text.includes("NameNotAvailable") || text.includes("LabelUnavailable")) {
    return {
      kind: "name-unavailable",
      message: "That subname is already taken.",
      hint: "Pick a different label.",
    };
  }
  if (text.includes("CreateCollision") || text.includes("deployment failed")) {
    return {
      kind: "salt-reused",
      message: "A contract already exists at the computed address.",
      hint: "Retry - a fresh deployment salt is generated automatically.",
    };
  }
  if (
    text.includes("block range") ||
    text.includes("query returned more than") ||
    text.includes("Log response size exceeded")
  ) {
    return {
      kind: "rpc-range",
      message: "The RPC refused a large log query.",
      hint: "The scan retries automatically with smaller chunks.",
    };
  }
  return {
    kind: "unknown",
    message: (e.shortMessage || e.message || "Something went wrong.").slice(0, 300),
  };
}
