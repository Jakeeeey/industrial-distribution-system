import React from "react";
import type { ConsolidationHeader, ConsolidationTransaction, CompanyProfile } from "../types/billing-consolidation.types";

// DEV-CHANGE: Strong-typed company prop using CompanyProfile to resolve unexpected any error
interface InvoicePrintTemplateProps {
  header: ConsolidationHeader;
  transactions: ConsolidationTransaction[];
  company?: CompanyProfile | null;
}

const formatDateShort = (iso?: string | null) => {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function InvoicePrintTemplate({ header, transactions, company }: InvoicePrintTemplateProps) {
  const totalGross = transactions.reduce((s, tx) => s + tx.gross_amount, 0);
  const totalVat = transactions.reduce((s, tx) => s + (tx.gross_amount - tx.gross_amount / 1.12), 0);
  const vatableSales = totalGross / 1.12;
  const totalNet = totalGross; // VAT inclusive

  const companyAddress = company
    ? [
      company.company_address,
      company.company_brgy,
      company.company_city,
      company.company_province,
      company.company_zipCode,
    ]
      .filter(Boolean)
      .join(", ")
    : "123 Industrial Road, Metro Manila, Philippines";

  const companyContact = company
    ? [company.company_contact, company.company_email].filter(Boolean).join(" | ")
    : null;



  // Date calculation: Due Date is 10 days after the invoice date
  const invoiceDateObj = new Date();
  const dueDateObj = new Date();
  dueDateObj.setDate(invoiceDateObj.getDate() + 10);

  const invoiceDateStr = invoiceDateObj.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const dueDateStr = dueDateObj.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // DEV-CHANGE: Removed unused today variable to resolve eslint warning
  // Pick the first generated SI No if available
  const invoiceNo = transactions.find((t) => t.sales_invoice_no)?.sales_invoice_no || "N/A";

  // DEV-CHANGE: Sort transactions by date and id to compute chronological start and end readings
  const meteredTxs = [...transactions]
    .filter((tx) => tx.meter_reading && tx.status !== "CANCELLED")
    .sort((a, b) => {
      if (a.transaction_date !== b.transaction_date) {
        return a.transaction_date.localeCompare(b.transaction_date);
      }
      return a.id - b.id;
    });

  const hasMetered = meteredTxs.length > 0;
  const firstTx = hasMetered ? meteredTxs[0] : null;
  const lastTx = hasMetered ? meteredTxs[meteredTxs.length - 1] : null;

  // On onboarding baseline transactions, the start of the billing consumption starts at the baseline current_reading
  const startReading = firstTx
    ? firstTx.transaction_type === "ONBOARDING_BASELINE"
      ? firstTx.meter_reading?.current_reading ?? 0
      : firstTx.meter_reading?.previous_reading ?? 0
    : 0;

  const endReading = lastTx ? lastTx.meter_reading?.current_reading ?? 0 : 0;





  const totalBillableKg = transactions
    .filter((tx) => tx.transaction_type !== "ONBOARDING_BASELINE" && tx.status !== "CANCELLED")
    .reduce((sum, tx) => sum + tx.billable_kg, 0);

  return (
    <div className="w-full flex-1 flex flex-col justify-between text-black font-sans text-xs select-none">
      {/* AG-CHANGE: Overhauled layout to simulate the Hawaii Gas utility monthly statement style */}
      <div>
        {/* ── Top Header Section (Logo on Left, Account Summary Box on Right) ── */}
        <div className="flex justify-between items-start gap-4 mb-3">
          {/* Company Brand (Left) */}
          <div className="flex-1">
            {company?.company_logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.company_logo}
                alt="Company Logo"
                className="h-10 w-auto object-contain mb-1 max-w-[150px]"
              />
            )}
            <h1 className="text-base font-bold text-gray-900 leading-tight">
              {company?.company_name || ""}
            </h1>
            <p className="text-[10px] text-gray-500 leading-normal max-w-[280px]">
              {companyAddress}
              {companyContact && <span className="block mt-0.5">{companyContact}</span>}
              <span className="block mt-0.5">TIN: {company?.company_tin || "000-111-222-000"}</span>
            </p>
          </div>

          {/* Account Summary Box (Right) */}
          <div className="w-[440px] border border-gray-400 text-[10px] grid grid-cols-2 divide-x divide-gray-400">
            {/* Box Column 1: Metadata */}
            <div className="p-2 space-y-1 bg-gray-50/50">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-500">Account Number</span>
                <span className="font-mono text-gray-900 font-bold">{header.customer_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-500">Invoice Number</span>
                <span className="font-mono text-gray-900 font-bold">{invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-500">Last Bill Date</span>
                <span className="text-gray-900">{formatDateShort(header.period_from)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-500">Current Bill Date</span>
                <span className="text-gray-900">{invoiceDateStr}</span>
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-1 mt-1 text-red-600 font-bold">
                <span>Due Date</span>
                <span>{dueDateStr}</span>
              </div>
            </div>

            {/* Box Column 2: Conversions & Consolidation */}
            {/* DEV-CHANGE: Unified Computation requested by management to hide WIWO vs Meter source. 
                WIWO kg is converted back to M3 equivalent and summed with Metered M3. */}
            <div className="p-2 space-y-1 text-[9px] leading-tight">
              <div className="border-b border-gray-300 pb-1 mb-1">
                <span className="font-bold text-gray-900 block uppercase text-[8px] tracking-wider mb-0.5">Consumption Summary</span>
                
                {hasMetered && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Previous Meter Reading</span>
                      <span className="font-mono text-gray-900">{startReading.toFixed(3)} M3</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Current Meter Reading</span>
                      <span className="font-mono text-gray-900">{endReading.toFixed(3)} M3</span>
                    </div>
                  </>
                )}
                
                {/* Unified M3 computation: sum of metered M3 and WIWO M3 equivalent. 
                    Since M3 to kg conversion is essentially 1:1 or derived from total, we use totalBillableKg as the unified volume. */}
                <div className="flex justify-between mt-1 pt-1 border-t border-gray-100">
                  <span className="text-gray-700 font-semibold">Total Equivalent Volume</span>
                  <span className="font-mono text-gray-900 font-bold">{totalBillableKg.toFixed(3)} M3</span>
                </div>

                <div className="flex justify-between font-bold text-gray-700 mt-1 pt-1 border-t border-gray-200">
                  <span>Total Billable Qty (Converted)</span>
                  <span className="font-mono">{totalBillableKg.toFixed(3)} kg</span>
                </div>
              </div>

              <div className="flex justify-between text-gray-700 font-semibold pt-0.5">
                <span>Current Charges</span>
                <span className="font-mono">₱ {totalNet.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-1 mt-1 text-gray-900 font-bold text-[10px]">
                <span>Total Amount Due</span>
                <span className="font-mono">₱ {totalNet.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Customer Account Details Ribbon ── */}
        <div className="border-t-2 border-b-2 border-gray-800 py-1 mb-3 text-[10px] grid grid-cols-4 gap-4 bg-gray-50/20">
          <div>
            <span className="text-gray-500 block text-[9px] uppercase font-semibold">Account Name</span>
            <span className="font-bold text-gray-900">{header.customer?.customer_name || header.customer_id}</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500 block text-[9px] uppercase font-semibold">Service Address</span>
            <span className="font-medium text-gray-900">{header.site?.site_address || "Address not provided"}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-500 block text-[9px] uppercase font-semibold">Customer Code</span>
            <span className="font-mono font-bold text-gray-900">{header.customer_id}</span>
          </div>
        </div>

        {/* ── DEV-CHANGE: Period-over-Period Consumption Summary ──
            Displayed when previous posted header data is available.
            Shows prior period KG/M3 vs current period KG/M3 with delta change. */}
        <div className="mb-3 border border-gray-300 rounded text-[9px]">
          <div className="bg-gray-100 px-2 py-0.5 border-b border-gray-300">
            <span className="font-black uppercase tracking-wider text-[8px] text-gray-700">Consumption Summary</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-gray-500 uppercase text-[8px] font-semibold border-b border-gray-200">
                <th className="py-0.5 px-2 text-left">Period</th>
                <th className="py-0.5 px-2 text-right">Billed KG</th>
                <th className="py-0.5 px-2 text-right">Billed M3 (Metered)</th>
                <th className="py-0.5 px-2 text-right">Change (KG)</th>
              </tr>
            </thead>
            <tbody>
              {/* Previous period row — hidden if no prior data */}
              {(header.prev_total_billed_kg != null || header.prev_total_billed_m3 != null) ? (
                <tr className="text-gray-600 border-b border-gray-100">
                  <td className="py-0.5 px-2">
                    <span className="text-gray-400">Previous Period</span>
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono">
                    {header.prev_total_billed_kg != null ? header.prev_total_billed_kg.toFixed(3) : "—"} kg
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono">
                    {header.prev_total_billed_m3 != null ? header.prev_total_billed_m3.toFixed(3) : "—"} M3
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono text-gray-400">—</td>
                </tr>
              ) : (
                <tr className="text-gray-400 border-b border-gray-100">
                  <td className="py-0.5 px-2">Previous Period</td>
                  <td colSpan={3} className="py-0.5 px-2 text-right italic">No prior period data</td>
                </tr>
              )}
              {/* Current period row */}
              <tr className="text-gray-800 font-semibold">
                <td className="py-0.5 px-2">
                  <span className="font-black">Current Period</span>
                  <span className="text-gray-400 font-normal ml-1">({header.period_from} → {header.period_to})</span>
                </td>
                <td className="py-0.5 px-2 text-right font-mono font-black">{totalBillableKg.toFixed(3)} kg</td>
                <td className="py-0.5 px-2 text-right font-mono">{totalBillableKg.toFixed(3)} M3</td>
                <td className="py-0.5 px-2 text-right font-mono">
                  {header.prev_total_billed_kg != null ? (
                    (() => {
                      const delta = totalBillableKg - header.prev_total_billed_kg;
                      return (
                        <span className={delta >= 0 ? "text-emerald-700" : "text-red-600"}>
                          {delta >= 0 ? "+" : ""}{delta.toFixed(3)} kg
                        </span>
                      );
                    })()
                  ) : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Service Type Line */}
        <p className="text-[10px] font-semibold text-gray-700 mb-2">
          Service Type: <span className="text-gray-900">LPG Monthly Metered & Bulk Supply</span>
        </p>

        {/* ── Main Block (Left: Current Charges, Right: Bill Message Box) ── */}
        <div className="grid grid-cols-3 gap-6 items-start mb-4">
          {/* Left Table Panel (col-span-2) */}
          <div className="col-span-2">
            <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-wider mb-1.5 border-b border-gray-300 pb-0.5">
              Current Charges Breakdown
            </h3>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-gray-500 uppercase font-semibold">
                  <th className="py-1 text-left">Description</th>
                  <th className="py-1 text-right">Qty (kg)</th>
                  <th className="py-1 text-right">Rate</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              {/* DEV-CHANGE: Group transactions by sales_invoice_no. Each group renders a SI header row,
                  followed by transaction rows showing transaction_no as sub-description.
                  Meter reading detail line removed per user request. */}
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="text-gray-800 border-b border-gray-100 last:border-0">
                    <td className="py-1.5 pl-1 text-left">
                      <div className="font-mono font-semibold text-[10px] text-gray-800">{tx.transaction_no}</div>
                      <div className="text-[8.5px] text-gray-500 mt-0.5 font-medium">
                        <span className="text-gray-700 font-bold mr-1">
                          {tx.sales_invoice_no ? `SI: ${tx.sales_invoice_no}` : "No SI"}
                        </span>
                        · LPG Delivery · {tx.transaction_date}
                      </div>
                    </td>
                    <td className="py-1.5 text-right font-mono">{tx.billable_kg.toFixed(3)}</td>
                    <td className="py-1.5 text-right font-mono">₱ {tx.price_per_kg.toFixed(2)}</td>
                    <td className="py-1.5 text-right font-mono font-semibold">₱ {tx.gross_amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Sub-charges Summary */}
            <div className="mt-3 flex justify-end">
              <div className="w-52 space-y-1 text-[10px] border-t border-gray-300 pt-2">
                <div className="flex justify-between text-gray-600">
                  <span>Vatable Sales</span>
                  <span className="font-mono">₱ {vatableSales.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>VAT Amount (12%)</span>
                  <span className="font-mono">₱ {totalVat.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-900 font-bold border-t border-gray-200 pt-1 mt-1">
                  <span>Total Current Charges</span>
                  <span className="font-mono">₱ {totalNet.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Message Box (col-span-1) */}
          <div className="border border-gray-300 rounded-lg p-3 bg-gray-50/30 text-[10px] leading-relaxed">
            <h4 className="font-bold text-gray-800 border-b border-gray-300 pb-1 mb-2">Bill Message</h4>
            <p className="text-gray-600 mb-2">
              This monthly utility bill is generated automatically based on consolidated customer cylinder weight consumption and meter log adjustments.
            </p>
            <p className="font-semibold text-gray-900 uppercase text-[9px] tracking-wide mt-3">
              This bill is subject to output VAT. Please pay on or before the due date to avoid service disruption. Thank you!
            </p>
          </div>
        </div>
      </div>

      {/* ── Payment Coupon Section (Always pushed to bottom) ── */}
      <div className="mt-auto">
        {/* Detach Line */}
        <div className="border-t border-dashed border-gray-400 pt-2 mb-3 text-center">
          <span className="text-[8px] text-gray-500 uppercase tracking-widest bg-white px-2 -translate-y-4 inline-block">
          </span>
        </div>

        {/* Coupon Layout Grid */}
        <div className="grid grid-cols-4 gap-4 text-[10px]">
          {/* Coupon Left Details */}
          <div className="col-span-2 space-y-3">
            <div>
              <span className="text-gray-500 block text-[9px] uppercase">Account Number</span>
              <span className="font-mono font-bold text-sm text-gray-900">{header.customer_id}</span>
            </div>

            {/* Mailing Info Address Placement */}
            <div className="pt-2 pl-4 border-l-2 border-gray-300">
              <p className="font-bold text-gray-900">{header.customer?.customer_name || header.customer_id}</p>
              <p className="text-[9px] text-gray-600 max-w-[240px]">
                {header.site?.site_address || "Address not provided"}
              </p>
            </div>
          </div>

          {/* Coupon Middle Balances & Due Date */}
          {/* DEV-CHANGE: Cleaned up coupon balances list to only show current charges & due date for consistency */}
          <div className="col-span-1 border-r border-gray-200 pr-2 space-y-1">
            <div className="flex justify-between text-gray-500">
              <span>Current Charge</span>
              <span>₱ {totalNet.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-900 border-t border-gray-200 pt-1 mt-1 font-bold">
              <span>Due Date</span>
              <span className="text-red-600">{dueDateStr}</span>
            </div>
          </div>

          {/* Coupon Right Total Due & Payee Info */}
          <div className="col-span-1 pl-2 flex flex-col justify-between items-end text-right">
            <div>
              <span className="text-gray-500 block text-[9px] uppercase">Total Payment Due</span>
              <span className="text-lg font-black text-gray-900 font-mono">
                ₱ {totalNet.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Payee Box */}
            <div className="text-[8.5px] text-gray-500 leading-snug mt-4">
              <p className="font-bold text-gray-700">Make checks payable to:</p>
              <p className="font-bold text-gray-900">{company?.company_name || ""}</p>
              <p className="max-w-[150px]">{companyAddress}</p>
            </div>
          </div>
        </div>

        {/* Regulatory Footer */}
        <div className="border-t border-gray-300 pt-2 mt-4 text-[8px] text-gray-400 flex flex-col items-center text-center space-y-0.5">
          <p className="font-semibold">THIS INVOICE/RECEIPT SHALL BE VALID FOR FIVE (5) YEARS FROM THE DATE OF ATP.</p>
          <p>BIR ATP No: 1234567890 | Date Issued: Jan 01, 2024 | TIN: {company?.company_tin || "000-111-222-000"} | Printer: ACME Press</p>
        </div>
      </div>
    </div>
  );
}
