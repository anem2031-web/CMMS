/** Display scope only, after the server's central PO read guard has allowed the
 * parent. A delegate prepares their own draft before anyone assigns its items.
 * This exception ends at submission and grants no pricing/write/PDF permission.
 */
export function isDelegateOwnPurchaseDraft(
  user: { id: number; role: string },
  po: { requestedById: number | null; status: string },
): boolean {
  return user.role === "delegate" && po.status === "draft"
    && Number.isSafeInteger(user.id) && user.id > 0
    && Number(po.requestedById) === user.id;
}
