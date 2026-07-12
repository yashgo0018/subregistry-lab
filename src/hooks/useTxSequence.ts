/**
 * Transaction sequence runner. Walks a StepDef[] plan:
 *   simulate (writes) -> wallet -> mining -> onReceipt ctx patch -> verify -> done.
 *
 * Resumable by design:
 * - each step's state (incl. txHash) is persisted to the session immediately;
 * - a step whose verify() already passes is auto-skipped ("already done");
 * - on failure/rejection, run() can be called again and continues from the
 *   first step that isn't done (fresh salts are derived inside build()).
 */

import { useCallback, useRef, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import type { Abi, Address } from "viem";
import { classifyError } from "../lib/errors";
import type { ReadFn, StepCtx, StepDef } from "../lib/steps";
import { useLab } from "../state/LabContext";
import type { StepState } from "../state/labSession";

export type SequenceStatus = "idle" | "running" | "done" | "failed";

export type SequenceHandle = {
  status: SequenceStatus;
  /** stepId -> state, live during the run and rehydrated from the session. */
  steps: Record<string, StepState>;
  /** Kick off (or resume) the sequence. */
  run: (plan: StepDef[], initialCtx: StepCtx) => Promise<StepCtx | undefined>;
  reset: () => void;
};

export function useTxSequence(sequenceId: string): SequenceHandle {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { session, dispatch } = useLab();
  const [status, setStatus] = useState<SequenceStatus>("idle");
  const running = useRef(false);
  const currentStepId = useRef<string>(undefined);

  const persisted = session?.sequences[sequenceId] ?? {};
  const [live, setLive] = useState<Record<string, StepState>>({});
  const steps = { ...persisted, ...live };

  const setStep = useCallback(
    (stepId: string, state: StepState) => {
      setLive((prev) => ({ ...prev, [stepId]: state }));
      dispatch({ type: "step-state", sequenceId, stepId, state });
    },
    [dispatch, sequenceId],
  );

  const reset = useCallback(() => {
    setLive({});
    setStatus("idle");
    dispatch({ type: "reset-sequence", sequenceId });
  }, [dispatch, sequenceId]);

  const run = useCallback(
    async (plan: StepDef[], initialCtx: StepCtx): Promise<StepCtx | undefined> => {
      if (running.current || !publicClient || !walletClient) return undefined;
      running.current = true;
      setStatus("running");

      const read: ReadFn = (params) =>
        publicClient.readContract({
          address: params.address,
          abi: params.abi,
          functionName: params.functionName,
          args: params.args as unknown[],
        });

      // Rehydrate ctx patches from previously completed steps where possible
      // is unnecessary: address patches live in the session already and the
      // caller passes them in via initialCtx. We just avoid re-running steps.
      let ctx: StepCtx = { ...initialCtx };
      const account = walletClient.account?.address as Address;

      try {
        for (const step of plan) {
          const prior = (session?.sequences[sequenceId] ?? {})[step.id];
          if (prior?.status === "done" || prior?.status === "skipped") continue;

          if (step.skipIf?.(ctx)) {
            setStep(step.id, { status: "skipped" });
            continue;
          }

          // Idempotence guard: if the outcome is already on-chain, skip.
          if (step.verify) {
            try {
              const pre = await step.verify(read, ctx);
              if (pre.ok) {
                setStep(step.id, { status: "done", detail: `Already done: ${pre.detail}` });
                continue;
              }
            } catch {
              // verify not answerable yet (e.g. missing ctx) - proceed normally
            }
          }

          currentStepId.current = step.id;
          const action = step.build(ctx);
          setStep(step.id, { status: "wallet" });

          let txHash: `0x${string}`;
          if (action.type === "write") {
            // Pre-flight simulation surfaces reverts before the wallet popup.
            await publicClient.simulateContract({
              account,
              address: action.address,
              abi: action.abi,
              functionName: action.functionName,
              args: action.args as unknown[],
            });
            txHash = await walletClient.writeContract({
              account,
              chain: walletClient.chain,
              address: action.address,
              abi: action.abi,
              functionName: action.functionName,
              args: action.args as unknown[],
            });
          } else {
            txHash = await walletClient.deployContract({
              account,
              chain: walletClient.chain,
              abi: action.abi as Abi,
              bytecode: action.bytecode,
              args: action.args as unknown[],
            });
          }

          setStep(step.id, { status: "mining", txHash });
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
            confirmations: 1,
          });
          if (receipt.status !== "success") {
            throw new Error(`Transaction reverted: ${txHash}`);
          }

          if (step.onReceipt) {
            const patch = step.onReceipt(receipt, ctx);
            ctx = { ...ctx, ...patch };
            // Persist deployed addresses immediately so refreshes survive.
            const addressPatch: Record<string, Address> = {};
            if (patch.userRegistry) addressPatch.userRegistry = patch.userRegistry;
            if (patch.resolver) addressPatch.resolver = patch.resolver;
            if (patch.registrar) addressPatch.registrar = patch.registrar;
            if (Object.keys(addressPatch).length > 0) {
              dispatch({ type: "patch-addresses", patch: addressPatch });
            }
            if (patch.userRegistry) {
              dispatch({ type: "set-registry-deploy-block", block: receipt.blockNumber });
            }
          }

          if (step.verify) {
            setStep(step.id, { status: "verifying", txHash });
            const result = await step.verify(read, ctx);
            if (!result.ok) {
              setStep(step.id, {
                status: "failed",
                txHash,
                detail: result.detail,
                errorKind: "verify-failed",
              });
              setStatus("failed");
              return undefined;
            }
            setStep(step.id, { status: "done", txHash, detail: result.detail });
          } else {
            setStep(step.id, { status: "done", txHash });
          }
        }

        setStatus("done");
        return ctx;
      } catch (err) {
        const classified = classifyError(err);
        if (currentStepId.current) {
          setStep(currentStepId.current, {
            status: "failed",
            detail: classified.hint ? `${classified.message} ${classified.hint}` : classified.message,
            errorKind: classified.kind,
          });
        }
        setStatus("failed");
        return undefined;
      } finally {
        running.current = false;
        currentStepId.current = undefined;
      }
    },
    [publicClient, walletClient, session, sequenceId, dispatch, setStep],
  );

  return { status, steps, run, reset };
}
