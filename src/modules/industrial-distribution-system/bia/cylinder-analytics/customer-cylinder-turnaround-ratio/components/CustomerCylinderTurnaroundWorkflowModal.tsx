// components/CustomerCylinderTurnaroundWorkflowModal.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Modal dialog to enforce required audit reasons during workflow status transitions
// (Draft -> For Review -> Approved -> Locked)
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldAlert, CheckCircle2, Lock } from "lucide-react";
import { useCustomerCylinderTurnaround } from "../providers/CustomerCylinderTurnaroundProvider";

export function CustomerCylinderTurnaroundWorkflowModal() {
  const {
    isWorkflowModalOpen,
    setIsWorkflowModalOpen,
    pendingTargetStatus,
    setPendingTargetStatus,
    submitWorkflowAction,
    assessmentNo,
  } = useCustomerCylinderTurnaround();

  const [role, setRole] = React.useState<string>("Finance");
  const [reason, setReason] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (pendingTargetStatus === "APPROVED") {
      setRole("Finance");
      setReason("Verified repeat orders, deposits, and turnaround grades against billing records.");
    } else if (pendingTargetStatus === "LOCKED") {
      setRole("Management");
      setReason("Assessment finalized and locked for Finance disbursement schedule.");
    } else if (pendingTargetStatus === "FOR_REVIEW") {
      setRole("Sales");
      setReason("Completed initial monthly circulation tally for Finance review.");
    }
  }, [pendingTargetStatus]);

  if (!pendingTargetStatus) return null;

  const handleSubmit = async () => {
    if (!reason.trim() || reason.trim().length < 5) {
      setError("Please provide a thorough justification for the audit trail.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const ok = await submitWorkflowAction(pendingTargetStatus, role, reason.trim());
    setIsSubmitting(false);

    if (!ok) {
      setError("Failed to record workflow transition. Please try again.");
    }
  };

  return (
    <Dialog
      open={isWorkflowModalOpen}
      onOpenChange={(open) => {
        if (!open) {
          setIsWorkflowModalOpen(false);
          setPendingTargetStatus(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            {pendingTargetStatus === "LOCKED" ? (
              <Lock className="h-5 w-5 text-slate-700 dark:text-slate-300" />
            ) : pendingTargetStatus === "APPROVED" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-sky-600" />
            )}
            <span>Confirm Workflow Transition: {pendingTargetStatus}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Updating the status of {assessmentNo} requires an immutable audit reason for compliance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Your Authorized Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sales" className="text-xs">Sales</SelectItem>
                <SelectItem value="Inventory" className="text-xs">Inventory</SelectItem>
                <SelectItem value="Finance" className="text-xs">Finance</SelectItem>
                <SelectItem value="Management" className="text-xs">Management</SelectItem>
                <SelectItem value="Administrator" className="text-xs">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Justification / Audit Reason</Label>
            <Textarea
              rows={3}
              placeholder="Explain the review findings, validations, or rationale..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs resize-none"
            />
            {error && <p className="text-[11px] text-rose-500 font-medium">{error}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsWorkflowModalOpen(false);
              setPendingTargetStatus(null);
            }}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="text-xs font-medium"
          >
            {isSubmitting ? "Recording..." : `Confirm & Set to ${pendingTargetStatus}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
