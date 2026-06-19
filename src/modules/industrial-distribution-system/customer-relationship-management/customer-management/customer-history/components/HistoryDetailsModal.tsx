"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CustomerHistoryRecord } from "../types";
import { User, Phone, MapPin, Building, ShieldCheck, Mail, Calendar } from "lucide-react";

interface HistoryDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    record: CustomerHistoryRecord | null;
}

export function HistoryDetailsModal({ open, onOpenChange, record }: HistoryDetailsModalProps) {
    if (!record) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[700px] bg-background border shadow-2xl rounded-2xl overflow-hidden p-0 gap-0">
                <DialogHeader className="p-6 bg-muted/30 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                <Building className="h-5 w-5 text-primary" />
                                {record.customer_name}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-1">
                                Customer Code: <span className="font-semibold">{record.customer_code}</span>
                            </DialogDescription>
                        </div>
                        <Badge
                            variant="outline"
                            className={
                                record.isActive
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                            }
                        >
                            {record.isActive ? "ACTIVE" : "INACTIVE"}
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* General Details */}
                    <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">General Information</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Customer Type</span>
                                <div className="text-sm font-medium flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-muted-foreground/75" />
                                    {record.type}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Store Name</span>
                                <div className="text-sm font-medium">{record.store_name || "-"}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Store Signage</span>
                                <div className="text-sm font-medium">{record.store_signage || "-"}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Assigned Salesman</span>
                                <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                    {record.salesman_name || "Unassigned"}
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Address & Contacts */}
                    <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Address & Contacts</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1 col-span-2">
                                <span className="text-[10px] text-muted-foreground block">Full Address</span>
                                <div className="text-sm font-medium flex items-start gap-1.5">
                                    <MapPin className="h-4 w-4 text-muted-foreground/75 mt-0.5 shrink-0" />
                                    <span>
                                        {[record.brgy, record.city, record.province].filter(Boolean).join(", ") || "No address provided"}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Contact Number</span>
                                <div className="text-sm font-medium flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5 text-muted-foreground/75" />
                                    {record.contact_number || "-"}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Email Address</span>
                                <div className="text-sm font-medium flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground/75" />
                                    {record.customer_email || "-"}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Telephone Number</span>
                                <div className="text-sm font-medium">{record.tel_number || "-"}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Geotag Coordinates</span>
                                <div className="text-sm font-medium">{record.location ? String(record.location) : "-"}</div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Financial / Compliance */}
                    <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Compliance & Terms</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Customer TIN</span>
                                <div className="text-sm font-medium">{record.customer_tin || "-"}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Payment Term</span>
                                <div className="text-sm font-medium">{record.payment_term ? `${record.payment_term} Days` : "-"}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Price Type</span>
                                <div className="text-sm font-medium">{record.price_type || "-"}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Tax Status</span>
                                <div className="flex gap-2 mt-1">
                                    <Badge variant={record.isVAT ? "default" : "secondary"} className="text-[9px] uppercase tracking-wider font-black">
                                        {record.isVAT ? "VAT" : "NON-VAT"}
                                    </Badge>
                                    <Badge variant={record.isEWT ? "default" : "secondary"} className="text-[9px] uppercase tracking-wider font-black">
                                        {record.isEWT ? "EWT" : "NO-EWT"}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* System audit info */}
                    <div className="bg-muted/40 rounded-xl p-4 flex items-center justify-between text-xs text-muted-foreground border">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                            <span>System Verified Log Record</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[10px]">
                            <Calendar className="h-3.5 w-3.5" />
                            {record.date_entered ? new Date(record.date_entered).toLocaleDateString() : "-"}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
