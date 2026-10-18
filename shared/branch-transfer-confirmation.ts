export function requiresBranchTransferConfirmation(source?: { id: number; type: string } | null, target?: { id: number; type: string } | null): boolean {
  return Boolean(source && target && source.id !== target.id && source.type === "branch" && target.type === "branch");
}
