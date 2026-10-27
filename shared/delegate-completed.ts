import { z } from "zod";

export const delegateCompletedInput = z.object({
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(200).default(""),
}).strict();
export type DelegateCompletedInput = z.infer<typeof delegateCompletedInput>;
export interface DelegateCompletedItem {
  id: number; purchaseOrderId: number; poNumber: string; itemName: string;
  quantity: number; unit: string | null; receivedAt: string | null;
}
