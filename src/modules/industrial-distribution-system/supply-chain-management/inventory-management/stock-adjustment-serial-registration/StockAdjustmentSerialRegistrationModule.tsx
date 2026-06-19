"use client";

import { useRouter } from "next/navigation";
import { StockAdjustmentForm } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-registration/components/forms/StockAdjustmentForm";

interface StockAdjustmentModuleProps {
  mode?: "creation" | "posting";
}

export default function StockAdjustmentSerialRegistrationModule({ mode = "creation" }: StockAdjustmentModuleProps) {
  const router = useRouter();

  return (
    <div className="stock-adjustment-module">
      <StockAdjustmentForm
        id={null}
        onCancel={undefined} // Hides cancel/back-to-list buttons, shows "Clear Form" instead
        onSuccess={() => {
          router.push("/ids/scm/inventory-management/stock-adjustment-serial-summary");
        }}
        mode={mode}
      />
    </div>
  );
}
