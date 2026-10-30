"use client";

import * as React from "react";

import {
  CustomerOrderConsumptionReportContext,
  type CustomerOrderConsumptionReportContextValue,
} from "../providers/CustomerOrderConsumptionReportProvider";

/**
 * Accessor for the report state. Throws when a component is mounted outside
 * the provider, which surfaces wiring mistakes instead of a blank table.
 */
export function useCustomerOrderConsumptionReport(): CustomerOrderConsumptionReportContextValue {
  const context = React.useContext(CustomerOrderConsumptionReportContext);
  if (!context) {
    throw new Error(
      "useCustomerOrderConsumptionReport must be used within CustomerOrderConsumptionReportProvider."
    );
  }
  return context;
}
