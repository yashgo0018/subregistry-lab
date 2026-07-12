/** External link builders: ENS Explorer + Sepolia Etherscan. */

export function explorerName(name: string): string {
  return `https://explorer.ens.dev/${name}`;
}

export function explorerRegistry(name: string): string {
  return `https://explorer.ens.dev/${name}/registry`;
}

export function etherscanAddress(address: string): string {
  return `https://sepolia.etherscan.io/address/${address}`;
}

export function etherscanTx(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}
