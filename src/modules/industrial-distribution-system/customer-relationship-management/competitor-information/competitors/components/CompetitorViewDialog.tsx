"use client";

import React from "react";
import { Building2, Clock, Globe, MapPin } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import type { Competitor, SystemUser } from "../types";
import { toWebsiteHref } from "../utils/formatters";

interface CompetitorViewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    competitor?: Competitor | null;
}

/**
 * Formats a user entity into a displayable string
 */
function formatUserDisplay(user: SystemUser | number | string | null | undefined): string {
    if (!user) return "—";
    if (typeof user === "object") {
        const fullName = [user.user_fname, user.user_lname].filter(Boolean).join(" ").trim();
        return fullName || (user.user_email ? String(user.user_email) : `User #${user.user_id}`);
    }
    return `User #${user}`;
}

/**
 * Formats timestamps for wall-clock audit presentation
 */
function formatAuditTime(value: string | null | undefined): string {
    if (!value) return "—";
    return value.replace("T", " ").slice(0, 19);
}

export function CompetitorViewDialog({
    open,
    onOpenChange,
    competitor,
}: CompetitorViewDialogProps) {
    const websiteHref = toWebsiteHref(competitor?.website ?? null);
    const websiteValue = websiteHref ? (
        <a
            href={websiteHref}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
        >
            {competitor?.website || websiteHref}
        </a>
    ) : (
        competitor?.website
    );

    const fields = [
        {
            label: "Competitor Name",
            value: competitor?.name,
            icon: Building2,
        },
        {
            label: "Website",
            value: websiteValue,
            icon: Globe,
        },
        {
            label: "Province",
            value: competitor?.province,
            icon: MapPin,
        },
        {
            label: "City",
            value: competitor?.city,
            icon: MapPin,
        },
        {
            label: "Barangay",
            value: competitor?.barangay,
            icon: MapPin,
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-155 overflow-hidden p-0 rounded-2xl border-2 shadow-2xl animate-in fade-in zoom-in-95">
                <div className="bg-linear-to-r from-primary/10 via-background to-primary/5 p-6 pb-4">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <Building2 className="h-6 w-6 text-primary stroke-[2.5px]" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold tracking-tight">
                                    Competitor Information
                                </DialogTitle>
                                <DialogDescription className="text-sm font-medium opacity-70">
                                    Full overview of the selected competitor profile.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <Separator className="bg-primary/10" />

                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {fields.map((field) => {
                            const Icon = field.icon;
                            const hasValue =
                                field.value !== null &&
                                field.value !== undefined &&
                                field.value !== "";
                            return (
                                <div key={field.label} className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon className="h-4 w-4 text-primary" />
                                        <p className="font-bold text-sm">{field.label}</p>
                                    </div>
                                    <div className="min-h-11 rounded-xl border-2 bg-muted/30 px-3 py-2 text-sm font-semibold">
                                        <span className="min-w-0 wrap-break-word">
                                            {hasValue ? field.value : "N/A"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Audit Trail Section */}
                    {competitor && (
                        <div className="rounded-xl border-2 bg-muted/20 p-5 space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                                <Clock className="h-4 w-4 text-primary" />
                                <h4 className="text-xs font-bold uppercase tracking-widest text-primary/80">
                                    Audit Trail
                                </h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Created By</p>
                                    <p className="text-sm font-semibold text-foreground/90">{formatUserDisplay(competitor.created_by)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Created At (PH time)</p>
                                    <p className="text-sm font-semibold text-foreground/90 tabular-nums">{formatAuditTime(competitor.created_at)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Last Updated By</p>
                                    <p className="text-sm font-semibold text-foreground/90">{formatUserDisplay(competitor.updated_by)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Last Updated At (PH time)</p>
                                    <p className="text-sm font-semibold text-foreground/90 tabular-nums">{formatAuditTime(competitor.updated_at)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 pb-6">
                    <Button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-8 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all"
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
