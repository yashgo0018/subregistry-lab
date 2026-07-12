import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";

/**
 * True when the app is safe to send transactions: wallet connected + on Sepolia.
 * Every write button in the app should be gated on this.
 */
export function useIsReady(): boolean {
  const { isConnected, chainId } = useAccount();
  return isConnected && chainId === sepolia.id;
}

/**
 * Banner shown whenever the connected wallet is on the wrong network.
 * Renders nothing when disconnected (connect UI handles that) or on Sepolia.
 */
export function ChainGuard() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === sepolia.id) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-amber-900">
      <span className="text-sm">
        This lab runs on <strong>Sepolia</strong>. Your wallet is on another
        network, so all actions are disabled.
      </span>
      <button
        type="button"
        className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
        disabled={isPending}
        onClick={() => switchChain({ chainId: sepolia.id })}
      >
        {isPending ? "Switching…" : "Switch to Sepolia"}
      </button>
    </div>
  );
}
