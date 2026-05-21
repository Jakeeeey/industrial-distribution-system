// src/app/(industrial-distribution-system)/ids/fm/accounting/customers-memo-approval/page.tsx

import React from "react";
import CustomersMemoApprovalModule from "@/modules/industrial-distribution-system/financial-management/accounting/customers-memo/components/CustomersMemoApprovalModule";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer Credit Memo Approval | Financial Management",
  description:
    "Approve pending Customer Credit Memos within the authorization queue.",
};

export default function CustomersMemoApprovalPage() {
  return <CustomersMemoApprovalModule />;
}
