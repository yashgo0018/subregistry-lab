import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { ChainGuard, useIsReady } from "../components/ChainGuard";
import { ConfigurePanel } from "../components/ConfigurePanel";
import { LockPanel } from "../components/LockPanel";
import { NamePicker } from "../components/NamePicker";
import { PlaygroundPanel } from "../components/PlaygroundPanel";
import { ReviewPanel } from "../components/ReviewPanel";
import { SetupInspector } from "../components/SetupInspector";
import { Section } from "../components/ui";
import { useLab } from "../state/LabContext";

export type SetupMode = "fresh" | "adopt" | "replace";

/**
 * Single-page vertical wizard. Sections unlock as prerequisites are met:
 * connect -> pick name -> inspect -> configure -> review/execute -> playground -> lock.
 */
export default function LabPage() {
  const { isConnected } = useAccount();
  const ready = useIsReady();
  const { session } = useLab();
  const [mode, setMode] = useState<SetupMode>();
  const [configured, setConfigured] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  // Adopting an existing registry skips deploy/review entirely.
  const adopted = mode === "adopt";
  const showConfigure = Boolean(session) && (mode === "fresh" || mode === "replace");
  const showReview = showConfigure && configured;
  const playgroundReady =
    Boolean(session?.addresses.userRegistry) && (adopted || setupComplete);

  return (
    <div className="mx-auto flex min-h-screen max-w-[58rem] flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ENSv2 Subregistry Lab</h1>
          <p className="text-sm opacity-70">
            Deploy and configure subname registries for your .eth names on Sepolia. No code
            required.
          </p>
        </div>
        <ConnectButton />
      </header>

      <ChainGuard />

      <main className="flex flex-col gap-6">
        <Section step={1} title="Connect your wallet" enabled>
          {isConnected ? (
            <p className="text-sm">
              Connected{ready ? " and on Sepolia. You're good to go." : "."}
            </p>
          ) : (
            <p className="text-sm">Use the connect button in the top right corner.</p>
          )}
        </Section>

        <Section step={2} title="Pick a name" enabled={ready}>
          <NamePicker />
        </Section>

        <Section step={3} title="Current setup" enabled={ready && Boolean(session)}>
          <SetupInspector
            onModeChosen={(m) => {
              setMode(m);
              setConfigured(false);
              setSetupComplete(false);
            }}
          />
        </Section>

        {showConfigure && (
          <Section step={4} title="Choose a configuration" enabled={ready}>
            <ConfigurePanel onDone={() => setConfigured(true)} />
          </Section>
        )}

        {showReview && (
          <Section step={5} title="Review and execute" enabled={ready}>
            <ReviewPanel onComplete={() => setSetupComplete(true)} />
          </Section>
        )}

        {playgroundReady && (
          <Section step={showReview ? 6 : 4} title="Playground" enabled={ready}>
            <PlaygroundPanel />
          </Section>
        )}

        {playgroundReady && (
          <details className="rounded-xl border border-red-200 bg-red-50/40 p-5">
            <summary className="cursor-pointer text-lg font-medium text-red-900">
              Advanced: make it unruggable
            </summary>
            <div className="mt-4">
              <LockPanel />
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
