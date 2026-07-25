// src/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/service.ts
import { SerialMovement, CylinderSummary, ExceptionDetail } from "./types";

/**
 * Parses movementAt string into a numeric timestamp for accurate sorting.
 * Supports various standard date-time patterns.
 */
export const parseMovementDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    // Replace custom dot separator if present in mock/historical records
    const cleaned = dateStr.replace(/·/g, "").replace(/\s+/g, " ").trim();
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

/**
 * Sorts movement timeline records chronologically (Oldest to Newest).
 * Tie-breaker: ASC by inQty (which places OUT before IN if timestamps are identical).
 * 
 * @param movements Raw movement list to sort.
 * @returns Sorted copy of the movements.
 */
export const getTimelineSortOrder = (movements: SerialMovement[]): SerialMovement[] => {
    return [...movements].sort((a, b) => {
        const timeA = parseMovementDate(a.movementAt);
        const timeB = parseMovementDate(b.movementAt);
        if (timeA !== timeB) {
            return timeA - timeB;
        }
        return a.inQty - b.inQty; // 0 (OUT) before 1 (IN)
    });
};

/**
 * Sorts movement records for ledger view (Newest first).
 * Tie-breaker: Alphabetical by serial number.
 * 
 * @param movements Movement list to sort.
 * @returns Sorted copy of the movements.
 */
export const getLedgerSortOrder = (movements: SerialMovement[]): SerialMovement[] => {
    return [...movements].sort((a, b) => {
        const timeA = parseMovementDate(a.movementAt);
        const timeB = parseMovementDate(b.movementAt);
        if (timeA !== timeB) {
            return timeB - timeA; // Descending
        }
        return a.serialNumber.localeCompare(b.serialNumber);
    });
};

/**
 * Groups raw movement records by product ID & serial number, deriving one summary record per serial.
 * Identifies the latest transaction using the tie-breaker rule: movementAt DESC, then inQty DESC.
 * 
 * @param movements Raw normalized serial movements.
 * @returns Array of unique cylinder summaries.
 */
export const groupMovementsBySerial = (movements: SerialMovement[]): CylinderSummary[] => {
    const groups = new Map<string, SerialMovement[]>();
    
    // Group movements by serial number
    movements.forEach((m) => {
        const key = m.serialNumber.trim().toUpperCase();
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(m);
    });

    const summaries: CylinderSummary[] = [];

    groups.forEach((items, serial) => {
        if (items.length === 0) return;

        // Sort items for latest movement candidate selection: movementAt DESC, then inQty DESC
        const sortedForLatest = [...items].sort((a, b) => {
            const timeA = parseMovementDate(a.movementAt);
            const timeB = parseMovementDate(b.movementAt);
            if (timeA !== timeB) {
                return timeB - timeA; // Descending date
            }
            return b.inQty - a.inQty; // Descending inQty (1/IN before 0/OUT)
        });

        const latest = sortedForLatest[0];

        // Determine direction: IN, OUT, Assignment (0/0), or Review (conflicting)
        let direction: "IN" | "OUT" | "Review" | "Assignment" = "Review";
        if (latest.inQty > 0 && latest.outQty === 0) {
            direction = "IN";
        } else if (latest.outQty > 0 && latest.inQty === 0) {
            direction = "OUT";
        } else if (latest.inQty === 0 && latest.outQty === 0) {
            // in_qty=0 AND out_qty=0 → Assignment movement (e.g. Sales Order Assignment, Customer Cylinder Assignment)
            direction = "Assignment";
        } else {
            direction = "Review";
        }

        // Store the timeline sorted chronologically (Oldest to Newest) inside the summary
        const chronologicalTimeline = getTimelineSortOrder(items);

        summaries.push({
            serialNumber: serial,
            productId: latest.productId,
            productName: latest.productName,
            lastHandlingBranch: latest.branchName || "—",
            lastMovementType: latest.documentType || "—",
            lastDocumentNo: latest.documentNo || "—",
            direction,
            lastMovementDate: latest.movementAt,
            movementCount: items.length,
            movements: chronologicalTimeline,
        });
    });

    return summaries.sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
};

/**
 * Evaluates grouped cylinder records client-side to detect inventory/movement exceptions.
 * 
 * Exceptions handled:
 * 1. Refills Overdue: Out to supplier for refill/dispatch, pending > 14 days.
 * 2. Unresolved Transfer: Outbound stock transfer dispatch with no inbound receipt.
 * 3. Stale Custody: Active cylinder with customer or elsewhere, no movement for > 90 days.
 * 4. Conflicting Movement: Multiple outbound transactions in a short window or Review status.
 * 
 * @param cylinders Grouped cylinder records.
 * @param referenceDate Base date for calculation (defaults to July 3, 2026).
 * @returns Array of exception details.
 */
export const detectExceptions = (
    cylinders: CylinderSummary[],
    referenceDate = new Date("2026-07-03T11:26:00")
): ExceptionDetail[] => {
    const exceptions: ExceptionDetail[] = [];

    cylinders.forEach((c) => {
        const lastDate = parseMovementDate(c.lastMovementDate);
        const daysElapsed = lastDate > 0 ? Math.floor((referenceDate.getTime() - lastDate) / (1000 * 60 * 60 * 24)) : 0;

        // Exception 1: Sent for refill but not returned
        // Condition: Latest movement direction is OUT, type contains "Refill" or "Supplier", and days > 14
        const isRefillDoc = /refill|supplier/i.test(c.lastMovementType);
        if (c.direction === "OUT" && isRefillDoc && daysElapsed > 14) {
            exceptions.push({
                id: `${c.serialNumber}-refill_overdue`,
                serialNumber: c.serialNumber,
                productName: c.productName,
                exceptionType: "refill_overdue",
                title: "Sent for refill but not returned",
                description: `${c.serialNumber} was dispatched through ${c.lastDocumentNo} and has been pending for ${daysElapsed} days.`,
            });
            return; // Only report one primary exception per cylinder
        }

        // Exception 2: Transfer dispatched but not received
        // Condition: Latest movement is OUT, type contains "Transfer" or "Dispatch" and not returned/refill
        const isTransferDoc = /transfer|dispatch/i.test(c.lastMovementType);
        if (c.direction === "OUT" && isTransferDoc && !isRefillDoc) {
            exceptions.push({
                id: `${c.serialNumber}-unresolved_transfer`,
                serialNumber: c.serialNumber,
                productName: c.productName,
                exceptionType: "unresolved_transfer",
                title: "Transfer dispatched but not received",
                description: `${c.serialNumber} was dispatched from ${c.lastHandlingBranch} but has no matching receive confirmation.`,
            });
            return;
        }

        // Exception 3: Potential conflicting movement
        // Condition: Review status or multiple movements in the same minute with OUT direction
        let hasSameMinuteOutConflicts = false;
        if (c.movements.length > 1) {
            for (let i = 0; i < c.movements.length - 1; i++) {
                const current = c.movements[i];
                const next = c.movements[i + 1];
                if (current.outQty > 0 && next.outQty > 0) {
                    const timeDiff = Math.abs(parseMovementDate(current.movementAt) - parseMovementDate(next.movementAt));
                    if (timeDiff <= 60 * 1000) { // 1 minute
                        hasSameMinuteOutConflicts = true;
                        break;
                    }
                }
            }
        }

        if (c.direction === "Review" || hasSameMinuteOutConflicts) {
            exceptions.push({
                id: `${c.serialNumber}-conflicting_movement`,
                serialNumber: c.serialNumber,
                productName: c.productName,
                exceptionType: "conflicting_movement",
                title: "Potential conflicting movement",
                description: `${c.serialNumber} contains conflicting movement records or multiple outbound actions within the same minute.`,
            });
            return;
        }

        // Exception 4: No movement for more than 90 days
        // Condition: Days elapsed > 90
        if (daysElapsed > 90) {
            exceptions.push({
                id: `${c.serialNumber}-stale_asset`,
                serialNumber: c.serialNumber,
                productName: c.productName,
                exceptionType: "stale_asset",
                title: "No movement for more than 90 days",
                description: `${c.serialNumber} is currently at ${c.lastHandlingBranch} and has not had a movement since ${c.lastMovementDate}.`,
            });
        }
    });

    return exceptions;
};
