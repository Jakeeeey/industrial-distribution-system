"use client";

import * as React from "react";

import {
  CustomerIncentiveReportContext,
  type CustomerIncentiveReportContextValue,
} from "../providers/CustomerIncentiveReportProvider";

/**
 * Accessor for the report state. Throws when a component is mounted outside
 * the provider, which surfaces wiring mistakes instead of a blank table.
 */
export function useCustomerIncentiveReport(): CustomerIncentiveReportContextValue {
  const context = React.useContext(CustomerIncentiveReportContext);
  if (!context) {
    throw new Error(
      "useCustomerIncentiveReport must be used within CustomerIncentiveReportProvider."
    );
  }
  return context;
}
