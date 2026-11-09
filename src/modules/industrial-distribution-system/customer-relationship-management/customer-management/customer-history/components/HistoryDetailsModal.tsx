"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/utils";
import { CustomerHistoryRecord } from "../types";

interface HistoryDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    record: CustomerHistoryRecord | null;
    storeTypeLabel?: string;
    classificationLabel?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="overflow-hidden rounded-lg border border-border/60 bg-background">
            <h3 className="border-b bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
            </h3>
            <dl className="divide-y divide-border/50">{children}</dl>
        </section>
    );
}

function Row({ label, children }: { label: string; children?: React.ReactNode }) {
    const isEmpty =
        children === undefined || children === null || children === "" || children === "—";
    return (
        <div className="flex items-baseline gap-4 px-4 py-2.5">
            <dt className="w-32 shrink-0 text-xs text-muted-foreground">{label}</dt>
            <dd className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">
                {isEmpty ? <span className="font-normal text-muted-foreground/60">—</span> : children}
            </dd>
        </div>
    );
}

// Directus serialises naive datetimes with a trailing "Z"; reading the date part
// as wall clock keeps the label from shifting a day in PH time.
function formatRecordDate(value?: string | null) {
    if (!value) return null;
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function CustomerAvatar({ imageId, name }: { imageId?: string | null; name: string }) {
    const [imageFailed, setImageFailed] = useState(false);
    const initials = name?.trim().slice(0, 2).toUpperCase() || "—";

    if (imageId && !imageFailed) {
        return (
            <img
                src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${imageId}`}
                alt=""
                onError={() => setImageFailed(true)}
                className="h-12 w-12 shrink-0 rounded-lg border border-border/60 object-cover"
            />
        );
    }

    return (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-sm font-semibold text-muted-foreground">
            {initials}
        </div>
    );
}

export function HistoryDetailsModal({
    open,
    onOpenChange,
    record,
    storeTypeLabel,
    classificationLabel,
}: HistoryDetailsModalProps) {
    // The parent keeps the last selection while the dialog fades out, so this
    // guard never blanks the body mid-animation.
    if (!record) return null;

    const data = record;
    const addressParts = [
        [data.house_no, data.unit_building].filter(Boolean).join(" "),
        data.street,
        data.purok_sitio,
        data.subdivision,
        data.brgy,
        data.city,
        data.province,
        data.zip_code,
    ].filter(Boolean);
    const creditLimit =
        data.credit_limit === null || data.credit_limit === undefined || data.credit_limit === ""
            ? null
            : Number(data.credit_limit);
    const createdOn = formatRecordDate(data.date_entered);
    const coords = (data.location || "").trim();
    const coordPair = coords.split(",").map((c) => c.trim()).filter(Boolean);
    const mapsUrl =
        coordPair.length === 2 && coordPair.every((c) => !Number.isNaN(Number(c)))
            ? `https://www.google.com/maps?q=${coordPair[0]},${coordPair[1]}`
            : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden rounded-xl border-border/70 p-0 shadow-2xl sm:max-w-[640px]">
                <DialogHeader className="flex-row items-start gap-4 border-b bg-muted/20 p-5 pr-12 text-left">
                    <CustomerAvatar key={data.id} imageId={data.customer_image} name={data.customer_name} />
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="break-words text-base font-semibold leading-snug tracking-tight">
                            {data.customer_name}
                        </DialogTitle>
                        <DialogDescription className="mt-1 truncate text-xs">
                            {data.customer_code || `PENDING-${data.id}`} · {data.type}
                        </DialogDescription>
                        <div className="mt-2">
                            <StatusBadge tone={data.isActive === 1 ? "success" : "neutral"}>
                                {data.isActive === 1 ? "Active" : "Inactive"}
                            </StatusBadge>
                        </div>
                    </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-background p-5">
                    <Section title="Business">
                        <Row label="Store Name">{data.store_name}</Row>
                        <Row label="Signage">{data.store_signage}</Row>
                        <Row label="Store Type">{storeTypeLabel}</Row>
                        <Row label="Classification">{classificationLabel}</Row>
                        <Row label="Salesman">
                            {data.salesman_name && data.salesman_name !== "N/A"
                                ? data.salesman_code
                                    ? `${data.salesman_name} (${data.salesman_code})`
                                    : data.salesman_name
                                : null}
                        </Row>
                    </Section>

                    <Section title="Contact & Location">
                        <Row label="Address">
                            {addressParts.length > 0 ? addressParts.join(", ") : null}
                        </Row>
                        <Row label="Mobile">{data.contact_number}</Row>
                        <Row label="Landline">{data.tel_number}</Row>
                        <Row label="Email">{data.customer_email}</Row>
                        <Row label="Coordinates">
                            {mapsUrl ? (
                                <span className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {coords}
                                    </span>
                                    <a
                                        href={mapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                                    >
                                        View on map
                                    </a>
                                </span>
                            ) : (
                                coords
                            )}
                        </Row>
                    </Section>

                    <Section title="Billing">
                        <Row label="TIN">{data.customer_tin}</Row>
                        <Row label="Tax Codes">
                            <span className="flex flex-wrap gap-1.5">
                                <StatusBadge tone={data.isVAT ? "info" : "neutral"}>
                                    {data.isVAT ? "VAT" : "Non-VAT"}
                                </StatusBadge>
                                <StatusBadge tone={data.isEWT ? "info" : "neutral"}>
                                    {data.isEWT ? "EWT" : "No EWT"}
                                </StatusBadge>
                            </span>
                        </Row>
                        <Row label="Payment Terms">
                            {data.payment_term ? `${data.payment_term} days` : null}
                        </Row>
                        <Row label="Price List">{data.price_type}</Row>
                        <Row label="Credit Limit">
                            {creditLimit !== null && Number.isFinite(creditLimit)
                                ? formatCurrency(creditLimit)
                                : null}
                        </Row>
                    </Section>
                </div>

                <div className="flex items-center justify-between gap-4 border-t bg-muted/20 px-5 py-3">
                    <p className="text-xs text-muted-foreground">
                        {createdOn ? `Record created ${createdOn}` : "No creation date recorded"}
                    </p>
                    <DialogClose asChild>
                        <Button variant="outline" size="sm" className="h-8 rounded-lg text-sm">
                            Close
                        </Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}
