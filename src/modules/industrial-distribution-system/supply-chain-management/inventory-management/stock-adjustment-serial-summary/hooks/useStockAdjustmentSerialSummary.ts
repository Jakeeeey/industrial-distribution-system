import { useStockAdjustmentSerialSummaryContext } from "../providers/StockAdjustmentSerialSummaryProvider";

export function useStockAdjustmentSerialSummary() {
  return useStockAdjustmentSerialSummaryContext();
}
export type UseStockAdjustmentSerialSummaryReturn = ReturnType<typeof useStockAdjustmentSerialSummary>;
