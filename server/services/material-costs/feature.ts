/** Enable only after the owner has applied the supplied SQL manually. */
export function materialExecutionCostsEnabled(): boolean {
  return process.env.MATERIAL_EXECUTION_COSTS_ENABLED === "true";
}
