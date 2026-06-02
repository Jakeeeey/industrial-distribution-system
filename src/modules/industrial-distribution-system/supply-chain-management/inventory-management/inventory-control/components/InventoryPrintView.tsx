"use client";

import React from "react";
import Barcode from "react-barcode";
import { QRCodeSVG } from "qrcode.react";
import type { EnrichedSerial, PrintOptions } from "../type";

function getLayoutConfig(orientation: "portrait" | "landscape", columns: number) {
    if (orientation === "portrait") {
        switch (columns) {
            case 2:
                return { rows: 3, itemsPerPage: 6 };
            case 4:
                return { rows: 5, itemsPerPage: 20 };
            case 3:
            default:
                return { rows: 4, itemsPerPage: 12 };
        }
    } else {
        // landscape
        switch (columns) {
            case 2:
                return { rows: 2, itemsPerPage: 4 };
            case 4:
                return { rows: 3, itemsPerPage: 12 };
            case 3:
            default:
                return { rows: 2, itemsPerPage: 6 };
        }
    }
}

function getMediaSizes(columns: number) {
    switch (columns) {
        case 2:
            return { qrSize: 130, barcodeWidth: 1.4, barcodeHeight: 65, fontSize: "13px" };
        case 4:
            return { qrSize: 95, barcodeWidth: 0.8, barcodeHeight: 35, fontSize: "9.5px" };
        case 3:
        default:
            return { qrSize: 115, barcodeWidth: 1.1, barcodeHeight: 50, fontSize: "11px" };
    }
}

interface InventoryPrintViewProps {
    productName: string;
    serials: EnrichedSerial[];
    options: PrintOptions;
}

export const InventoryPrintView = React.memo(
    React.forwardRef<HTMLDivElement, InventoryPrintViewProps>(
        ({ productName, serials, options }, ref) => {
            const paperStyles: React.CSSProperties =
                options.paperSize === "A4"
                    ? options.orientation === "portrait"
                        ? { width: "210mm", height: "297mm" }
                        : { width: "297mm", height: "210mm" }
                    : options.orientation === "portrait"
                        ? { width: "215.9mm", height: "279.4mm" }
                        : { width: "279.4mm", height: "215.9mm" };

            const layout = getLayoutConfig(options.orientation, options.columns || 3);
            const itemsPerPage = layout.itemsPerPage;

            // Resolve card display options with safe defaults
            const cardDisplay = options.cardDisplay ?? {
                showBarcodeNumber: true,
                showSerialNumber: true,
                showProductName: false,
                showStatusBadge: true,
            };

            // Split serials list into pages for multi-page print/preview support
            const pages: (EnrichedSerial | null)[][] = [];
            if (serials.length > 0) {
                for (let i = 0; i < serials.length; i += itemsPerPage) {
                    const pageSlice = serials.slice(i, i + itemsPerPage);
                    const paddedSlice: (EnrichedSerial | null)[] = [...pageSlice];
                    while (paddedSlice.length < itemsPerPage) {
                        paddedSlice.push(null);
                    }
                    pages.push(paddedSlice);
                }
            } else {
                pages.push([]);
            }

            return (
                <div
                    ref={ref}
                    className="print-container"
                >
                    <style dangerouslySetInnerHTML={{
                        __html: `
                    @page {
                        size: ${options.paperSize === "A4" ? "A4" : "letter"} ${options.orientation};
                        margin: 0;
                    }
                    @media print {
                        body {
                            background: white !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                        .print-container {
                            background: white !important;
                            padding: 0 !important;
                            margin: 0 !important;
                        }
                        .print-page {
                            margin: 0 !important;
                            box-shadow: none !important;
                            border: none !important;
                            border-radius: 0 !important;
                            page-break-after: always !important;
                            page-break-inside: avoid !important;
                            background: white !important;
                        }
                        .print-page:last-child {
                            page-break-after: avoid !important;
                        }
                    }
                    `
                    }} />
                    {pages.map((pageSerials, pageIdx) => (
                        <div
                            key={pageIdx}
                            className="print-page bg-white shadow-md border border-zinc-200 rounded-lg flex flex-col transition-all duration-300 select-none mb-8"
                            style={{
                                ...paperStyles,
                                boxSizing: "border-box",
                                padding: "15mm",
                            }}
                        >
                            {/* Page Header */}
                            <div
                                style={{
                                    borderBottom: "2px solid #1a1a1a",
                                    paddingBottom: "8px",
                                    marginBottom: "16px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    color: "black",
                                }}
                            >
                                <div style={{ textAlign: "left" }}>
                                    <h1 style={{ fontSize: "15px", fontWeight: 800, margin: 0, letterSpacing: "-0.025em" }}>
                                        LPG Inventory - {options.mode === "serial" ? "Serial QR" : "Barcode"} Report
                                    </h1>
                                    <p style={{ fontSize: "11px", margin: "2px 0 0", color: "#4b5563" }}>
                                        Product: <strong>{productName}</strong>
                                    </p>
                                </div>
                                <div style={{ textAlign: "right", fontSize: "10px", color: "#6b7280", lineHeight: "1.4" }}>
                                    <strong>Page {pageIdx + 1} of {pages.length}</strong>
                                    <br />
                                    <span>Total: {serials.length} records</span>
                                </div>
                            </div>

                            {/* Page Grid Contents */}
                            {serials.length === 0 ? (
                                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #d1d5db", borderRadius: "8px", height: "150px" }}>
                                    <p style={{ fontSize: "12px", color: "#9ca3af" }}>No serial numbers available for this product.</p>
                                </div>
                            ) : (
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: `repeat(${options.columns || 3}, minmax(0, 1fr))`,
                                        gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
                                        gap: "12px",
                                        flex: 1,
                                        alignContent: "stretch",
                                    }}
                                >
                                    {pageSerials.map((s, idx) => {
                                        if (s === null) {
                                            return (
                                                <div
                                                    key={`placeholder-${idx}`}
                                                    style={{
                                                        visibility: "hidden",
                                                        boxSizing: "border-box",
                                                    }}
                                                />
                                            );
                                        }
                                        const isFull = s.isFull;
                                        const value = s.barcode || s.serialNumber;
                                        const sizes = getMediaSizes(options.columns || 3);

                                        // Determine if the info section has any visible fields
                                        const showBarcodeNum = options.mode === "barcode" && cardDisplay.showBarcodeNumber;
                                        const showSerialNum = cardDisplay.showSerialNumber;
                                        const showProductName = cardDisplay.showProductName;
                                        const showBadge = cardDisplay.showStatusBadge;
                                        const hasInfoSection = showBarcodeNum || showSerialNum || showProductName || showBadge;

                                        return (
                                            <div
                                                key={s.id}
                                                style={{
                                                    border: "1px solid #e4e4e7",
                                                    borderRadius: "8px",
                                                    padding: "12px",
                                                    textAlign: "center",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    backgroundColor: "white",
                                                    boxSizing: "border-box",
                                                    height: "100%",
                                                }}
                                            >
                                                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: hasInfoSection ? "8px" : "0", width: "100%", overflow: "hidden" }}>
                                                    {options.mode === "serial" ? (
                                                        <QRCodeSVG
                                                            value={s.serialNumber}
                                                            size={sizes.qrSize}
                                                            level="M"
                                                        />
                                                    ) : (
                                                        <div style={{ transform: "scale(0.9)", transformOrigin: "center" }}>
                                                            <Barcode
                                                                value={value}
                                                                width={sizes.barcodeWidth}
                                                                height={sizes.barcodeHeight}
                                                                fontSize={14}
                                                                margin={0}
                                                                displayValue={false}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Card Info Section */}
                                                {hasInfoSection && (
                                                    <div style={{ width: "100%", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                                        

                                                        {/* Barcode Number (barcode mode only) */}
                                                        {showBarcodeNum && (
                                                            <p
                                                                style={{
                                                                    fontSize: sizes.fontSize,
                                                                    fontWeight: 800,
                                                                    margin: "0 0 1px 0",
                                                                    fontFamily: "monospace",
                                                                    color: "#18181b",
                                                                    whiteSpace: "nowrap",
                                                                    overflow: "hidden",
                                                                    textOverflow: "ellipsis",
                                                                    width: "100%",
                                                                    textAlign: "center",
                                                                }}
                                                            >
                                                                {value}
                                                            </p>
                                                        )}

                                                        {/* Serial Number */}
                                                        {showSerialNum && (
                                                            <p
                                                                style={{
                                                                    fontSize: sizes.fontSize,
                                                                    fontWeight: 800,
                                                                    margin: "0 0 1px 0",
                                                                    fontFamily: "monospace",
                                                                    color: "#18181b",
                                                                    whiteSpace: "nowrap",
                                                                    overflow: "hidden",
                                                                    textOverflow: "ellipsis",
                                                                    width: "100%",
                                                                    textAlign: "center",
                                                                }}
                                                            >
                                                                {s.serialNumber}
                                                            </p>
                                                        )}
{/* Product Name */}
                                                        {/* {showProductName && (
                                                                <p
                                                                    style={{
                                                                    fontSize: sizes.fontSize,
                                                                    fontWeight: 700,
                                                                    margin: "0 0 1px 0",
                                                                    color: "#3f3f46",
                                                                    whiteSpace: "nowrap",
                                                                    overflow: "hidden",
                                                                    textOverflow: "ellipsis",
                                                                    width: "100%",
                                                                    textAlign: "center",
                                                                    }}
                                                                >
                                                                    {s.productName}
                                                                </p>
                                                        )} */}

                                                        {showProductName && (
                                                            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1px", alignItems: "center" }}>
                                                                {/* Row 1: Primary Product Subheading */}
                                                                <p
                                                                    style={{
                                                                        fontSize: sizes.fontSize,
                                                                        fontWeight: 700,
                                                                        margin: 0,
                                                                        color: "#27272a", // Darker text for primary hierarchy
                                                                        whiteSpace: "nowrap",
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        width: "100%",
                                                                        textAlign: "center",
                                                                    }}
                                                                >
                                                                    {s.productName.split("-")[0]?.trim()}
                                                                </p>

                                                                {/* Row 2: Sub-identifier / Asset Serial Metadata (Renders only if '-' exists) */}
                                                                {s.productName.includes("-") && (
                                                                    <p
                                                                        style={{
                                                                            fontSize: "10px", // Scaled down slightly to establish proper structural hierarchy
                                                                            fontWeight: 700,
                                                                            margin: 0,
                                                                            color: "#27272a", // Darker text for primary hierarchy
                                                                            whiteSpace: "nowrap",
                                                                            overflow: "hidden",
                                                                            textOverflow: "ellipsis",
                                                                            width: "100%",
                                                                            textAlign: "center",
                                                                        }}
                                                                    >
                                                                        {s.productName.split("-").slice(1).join("-").trim()}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                        {/* Full / Empty Status Badge */}
                                                        {showBadge && (
                                                            <span
                                                                style={{
                                                                    display: "inline-block",
                                                                    fontSize: "8px",
                                                                    fontWeight: 700,
                                                                    padding: "1px 6px",
                                                                    borderRadius: "9999px",
                                                                    backgroundColor: isFull ? "#ecfdf5" : "#fff1f2",
                                                                    color: isFull ? "#059669" : "#e11d48",
                                                                    border: `1px solid ${isFull ? "#34d399" : "#f87171"}`,
                                                                }}
                                                            >
                                                                {s.status}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            );
        })
);

InventoryPrintView.displayName = "InventoryPrintView";
