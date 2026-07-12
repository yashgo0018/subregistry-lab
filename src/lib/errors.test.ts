import { describe, expect, it } from "vitest";
import { classifyError } from "./errors";

describe("classifyError", () => {
  it("user rejection via code and via name", () => {
    expect(classifyError({ code: 4001, message: "rejected" }).kind).toBe("user-rejected");
    expect(
      classifyError({ name: "UserRejectedRequestError", message: "User rejected the request." })
        .kind,
    ).toBe("user-rejected");
  });

  it("nested causes are searched", () => {
    const err = {
      name: "ContractFunctionExecutionError",
      message: "Execution reverted",
      cause: {
        name: "ContractFunctionRevertedError",
        message: "reverted with EACUnauthorizedAccountRoles(uint256,uint256,address)",
      },
    };
    expect(classifyError(err).kind).toBe("unauthorized");
  });

  it("chain mismatch", () => {
    expect(
      classifyError({ name: "ChainMismatchError", message: "chain does not match" }).kind,
    ).toBe("wrong-chain");
  });

  it("erc20 allowance and balance", () => {
    expect(classifyError({ message: "ERC20InsufficientAllowance(...)" }).kind).toBe(
      "insufficient-allowance",
    );
    expect(classifyError({ message: "ERC20InsufficientBalance(...)" }).kind).toBe(
      "insufficient-balance",
    );
  });

  it("gas money", () => {
    expect(classifyError({ message: "insufficient funds for gas * price + value" }).kind).toBe(
      "insufficient-eth",
    );
  });

  it("name availability", () => {
    expect(classifyError({ message: "NameNotAvailable(string)" }).kind).toBe("name-unavailable");
  });

  it("rpc range", () => {
    expect(classifyError({ message: "query returned more than 10000 results" }).kind).toBe(
      "rpc-range",
    );
  });

  it("unknown keeps a short message", () => {
    const res = classifyError({ shortMessage: "boom" });
    expect(res.kind).toBe("unknown");
    expect(res.message).toBe("boom");
  });
});
