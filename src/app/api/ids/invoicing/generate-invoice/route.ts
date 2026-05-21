import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

function directusHeaders() {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (DIRECTUS_TOKEN) h.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
    return h;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { order, receipts, receipt_type_id } = body;

        if (!order || !receipts || receipts.length === 0) {
            return NextResponse.json({ error: "Missing order or receipts data" }, { status: 400 });
        }

        let createdBy = null;
        const cookieStore = await cookies();
        const token = cookieStore.get("vos_access_token");
        if (token && token.value) {
            try {
                const payload = token.value.split(".")[1];
                const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf-8")) as { sub: string };
                if (decoded && decoded.sub) createdBy = parseInt(decoded.sub);
            } catch (e) {
                console.warn("Failed to decode token for created_by mapping:", e);
            }
        }

        const now = new Date().toISOString();
        const results = {
            orderUpdated: false,
            invoicesCreated: 0,
            invoiceDetailsCreated: 0,
            orderDetailsUpdated: 0,
            consolidatorDetailsUpdated: 0,
            createdInvoices: [] as { id: number; receipt_no: string }[],
            errors: [] as { step: string; product_id?: unknown; receipt_no?: string; error: string }[]
        };

        const newlyCreatedInvoiceIds: number[] = [];
        const updatedSalesOrderDetails: { detailId: number; originalQty: number }[] = [];
        const updatedConsolidatorDetails: { cdRecordId: number; originalQty: number }[] = [];
        let salesOrderWasUpdated = false;

        try {
            const nonVoidReceipts = receipts.filter((receipt: { is_void_reference?: boolean }) => !receipt.is_void_reference);
            const expectedReceiptCount = nonVoidReceipts.length;
            const expectedItemCount = nonVoidReceipts.reduce((sum: number, receipt: { items?: unknown[] }) => sum + (receipt.items?.length || 0), 0);

            const orderUpdateRes = await fetch(`${DIRECTUS_BASE}/items/sales_order/${order.order_id}`, {
                method: "PATCH",
                headers: directusHeaders(),
                body: JSON.stringify({
                    order_status: "For Loading",
                    for_loading_at: now,
                    receipt_type: receipt_type_id || order.receipt_type?.id || null
                })
            });
            if (!orderUpdateRes.ok) throw new Error(`Failed to update sales order status: ${await orderUpdateRes.text()}`);
            results.orderUpdated = true;
            salesOrderWasUpdated = true;

            let consolidatorId: number | null = null;
            const dpdRes = await fetch(`${DIRECTUS_BASE}/items/dispatch_plan_details?filter[sales_order_id][_eq]=${order.order_id}&fields=dispatch_id`, {
                headers: directusHeaders()
            });

            if (dpdRes.ok) {
                const dpdData = await dpdRes.json();
                const dispatchIds = Array.from(new Set(
                    (dpdData.data || [])
                        .map((d: { dispatch_id: number | string | { id?: number; dispatch_id?: number } | null }) => {
                            const id = d.dispatch_id;
                            if (typeof id === "number") return id;
                            if (typeof id === "string") return parseInt(id);
                            if (id && typeof id === "object") return id.id || id.dispatch_id;
                            return null;
                        })
                        .filter(Boolean)
                )) as number[];

                if (dispatchIds.length > 0) {
                    const dispatches = await Promise.all(dispatchIds.map(async (dId) => {
                        const dpRes = await fetch(`${DIRECTUS_BASE}/items/dispatch_plan/${dId}?fields=dispatch_no,dispatch_date`, {
                            headers: directusHeaders()
                        });
                        if (dpRes.ok) {
                            const dpData = await dpRes.json();
                            return dpData.data;
                        }
                        return null;
                    }));

                    const validDispatches = dispatches.filter(d => d && d.dispatch_no);
                    validDispatches.sort((a, b) => {
                        const dateA = a.dispatch_date ? new Date(a.dispatch_date).getTime() : 0;
                        const dateB = b.dispatch_date ? new Date(b.dispatch_date).getTime() : 0;
                        return dateB - dateA;
                    });

                    if (validDispatches.length > 0) {
                        const newestDispatchNo = validDispatches[0].dispatch_no;
                        const cdpRes = await fetch(`${DIRECTUS_BASE}/items/consolidator_dispatches?filter[dispatch_no][_eq]=${newestDispatchNo}&limit=1`, {
                            headers: directusHeaders()
                        });
                        if (cdpRes.ok) {
                            const cdpData = await cdpRes.json();
                            if (cdpData.data && cdpData.data.length > 0) {
                                consolidatorId = cdpData.data[0].consolidator_id;
                            }
                        }
                    }
                }
            }

            if (expectedItemCount > 0 && !consolidatorId) {
                throw new Error("Failed to resolve consolidator record for this order. Printing cancelled to prevent incomplete applied quantity updates.");
            }

            let isOfficial = String(order.receipt_type?.isOfficial ?? 1) === "1";
            if (receipt_type_id) {
                const rtRes = await fetch(`${DIRECTUS_BASE}/items/sales_invoice_type/${receipt_type_id}?fields=isOfficial`, {
                    headers: directusHeaders()
                });
                if (rtRes.ok) {
                    const rtData = await rtRes.json();
                    isOfficial = String(rtData.data?.isOfficial) === "1";
                }
            }

            let verifiedPaymentDays = 0;
            const pt = order.payment_terms;
            const paymentTermsId = pt && typeof pt === "object" ? (pt.id || null) : (pt || null);

            if (paymentTermsId) {
                const ptRes = await fetch(`${DIRECTUS_BASE}/items/payment_terms/${paymentTermsId}?fields=payment_days`, {
                    headers: directusHeaders()
                });
                if (ptRes.ok) {
                    const ptData = await ptRes.json();
                    verifiedPaymentDays = ptData.data?.payment_days || 0;
                } else {
                    console.warn(`[PaymentTerms] Failed to fetch terms for ID ${paymentTermsId}, falling back to payload.`);
                    verifiedPaymentDays = pt && typeof pt === "object" ? (pt.payment_days || 0) : 0;
                }
            }

            for (const receipt of receipts) {
                if (receipt.is_void_reference) continue;

                const grossAmount = receipt.items.reduce((sum: number, item: { qty: number; unit_price: number }) => sum + (item.qty * item.unit_price), 0);
                const discountAmount = receipt.items.reduce((sum: number, item: { discount_amount: number }) => sum + item.discount_amount, 0);
                const netAmount = receipt.items.reduce((sum: number, item: { net_amount: number }) => sum + item.net_amount, 0);
                const totalAmount = grossAmount - discountAmount;
                const isReceipt = isOfficial ? 1 : 0;
                const vatAmount = isOfficial ? (netAmount / 1.12) * 0.12 : 0;
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + verifiedPaymentDays);

                let targetInvoiceId = null;
                const invoicePayload: Record<string, unknown> = {
                    order_id: order.order_no,
                    customer_code: order.customer_code?.customer_code || null,
                    invoice_no: receipt.receipt_no,
                    salesman_id: order.salesman_id?.id || null,
                    branch_id: order.branch_id?.id || null,
                    invoice_date: now,
                    due_date: dueDate.toISOString(),
                    payment_terms: paymentTermsId,
                    transaction_status: "Prepared",
                    payment_status: "Unpaid",
                    total_amount: totalAmount,
                    invoice_type: receipt_type_id || order.receipt_type?.id || null,
                    price_type: order.salesman_id?.price_type || null,
                    sales_type: order.sales_type || null,
                    gross_amount: grossAmount,
                    discount_amount: discountAmount,
                    net_amount: netAmount,
                    isReceipt,
                    vat_amount: vatAmount,
                    modified_by: createdBy,
                    modified_date: now,
                    isPosted: 0,
                    isDispatched: 0,
                    isRemitted: 0
                };

                const targetId = receipt.target_id || order.existing_invoice_no;
                let isVoidReplacement = false;

                if (targetId) {
                    const checkRes = await fetch(`${DIRECTUS_BASE}/items/sales_invoice/${targetId}?fields=transaction_status`, {
                        headers: directusHeaders()
                    });
                    if (checkRes.ok) {
                        const checkData = await checkRes.json();
                        if (checkData.data?.transaction_status?.toUpperCase() === "VOID") {
                            isVoidReplacement = true;
                            const voidReplaceRes = await fetch(`${DIRECTUS_BASE}/items/sales_invoice/${targetId}`, {
                                method: "PATCH",
                                headers: directusHeaders(),
                                body: JSON.stringify({ isReplaced: 1 })
                            });
                            if (!voidReplaceRes.ok) throw new Error(`Failed to mark old void invoice ${targetId} as replaced.`);
                        }
                    }

                    if (!isVoidReplacement) {
                        const patchRes = await fetch(`${DIRECTUS_BASE}/items/sales_invoice/${targetId}`, {
                            method: "PATCH",
                            headers: directusHeaders(),
                            body: JSON.stringify(invoicePayload)
                        });
                        if (!patchRes.ok) throw new Error(`Failed to patch existing sales invoice ${targetId}: ${await patchRes.text()}`);
                        targetInvoiceId = targetId;

                        const clearDetailsRes = await fetch(`${DIRECTUS_BASE}/items/sales_invoice_details?filter[invoice_no][_eq]=${targetInvoiceId}`, {
                            method: "DELETE",
                            headers: directusHeaders()
                        });
                        if (!clearDetailsRes.ok) throw new Error(`Failed to clear old invoice details for invoice ${targetInvoiceId}: ${await clearDetailsRes.text()}`);
                    }
                }

                if (!targetInvoiceId) {
                    invoicePayload.created_by = createdBy;
                    invoicePayload.created_date = now;

                    const invoiceRes = await fetch(`${DIRECTUS_BASE}/items/sales_invoice`, {
                        method: "POST",
                        headers: directusHeaders(),
                        body: JSON.stringify(invoicePayload)
                    });
                    if (!invoiceRes.ok) throw new Error(`Failed to create sales invoice: ${await invoiceRes.text()}`);
                    const invoiceData = await invoiceRes.json();
                    targetInvoiceId = invoiceData.data.invoice_id;

                    if (targetInvoiceId) {
                        newlyCreatedInvoiceIds.push(typeof targetInvoiceId === "string" ? parseInt(targetInvoiceId) : targetInvoiceId);
                    }
                }

                results.invoicesCreated++;
                if (targetInvoiceId) {
                    results.createdInvoices.push({
                        id: typeof targetInvoiceId === "string" ? parseInt(targetInvoiceId) : targetInvoiceId,
                        receipt_no: receipt.receipt_no
                    });
                }

                for (const item of receipt.items) {
                    const podRes = await fetch(`${DIRECTUS_BASE}/items/sales_order_details?filter[order_id][_eq]=${order.order_id}&filter[product_id][_eq]=${item.product_id}`, {
                        headers: directusHeaders()
                    });
                    if (!podRes.ok) throw new Error(`Failed to fetch sales order details for product ${item.product_id}`);
                    const podData = await podRes.json();
                    if (!podData.data || podData.data.length === 0) {
                        throw new Error(`Missing sales_order_details row for order ${order.order_id}, product ${item.product_id}`);
                    }
                    const detailId = podData.data[0].detail_id;
                    const currentServed = podData.data[0].served_quantity || 0;
                    const newServedQty = currentServed + item.qty;

                    updatedSalesOrderDetails.push({ detailId, originalQty: currentServed });

                    const updatePodRes = await fetch(`${DIRECTUS_BASE}/items/sales_order_details/${detailId}`, {
                        method: "PATCH",
                        headers: directusHeaders(),
                        body: JSON.stringify({ served_quantity: newServedQty })
                    });
                    if (!updatePodRes.ok) throw new Error(`Failed to update served quantity for detail ${detailId}: ${await updatePodRes.text()}`);
                    results.orderDetailsUpdated++;

                    if (targetInvoiceId) {
                        const grossAmtItem = item.qty * item.unit_price;
                        const totalAmtItem = grossAmtItem - item.discount_amount;
                        let unitOfMeasurement = item.unit_of_measurement || null;
                        if (!unitOfMeasurement) {
                            try {
                                const prodRes = await fetch(`${DIRECTUS_BASE}/items/products/${item.product_id}?fields=unit_of_measurement`, {
                                    headers: directusHeaders()
                                });
                                if (prodRes.ok) {
                                    const prodData = await prodRes.json();
                                    unitOfMeasurement = prodData.data?.unit_of_measurement || null;
                                }
                            } catch {
                                console.warn(`Could not fetch product ${item.product_id} for unit mapping`);
                            }
                        }

                        const detailPayload = {
                            order_id: order.order_no,
                            invoice_no: targetInvoiceId,
                            discount_type: item.discount_type,
                            product_id: item.product_id,
                            unit: unitOfMeasurement,
                            unit_price: item.unit_price,
                            quantity: item.qty,
                            discount_amount: item.discount_amount,
                            gross_amount: grossAmtItem,
                            total_amount: totalAmtItem,
                            created_date: now
                        };

                        const detailRes = await fetch(`${DIRECTUS_BASE}/items/sales_invoice_details`, {
                            method: "POST",
                            headers: directusHeaders(),
                            body: JSON.stringify(detailPayload)
                        });
                        if (!detailRes.ok) throw new Error(`Failed to create invoice details for product ${item.product_id}: ${await detailRes.text()}`);
                        results.invoiceDetailsCreated++;
                    }

                    if (consolidatorId) {
                        const cdRes = await fetch(
                            `${DIRECTUS_BASE}/items/consolidator_details?filter[consolidator_id][_eq]=${consolidatorId}&filter[product_id][_eq]=${item.product_id}&limit=1`,
                            { headers: directusHeaders() }
                        );
                        if (!cdRes.ok) throw new Error(`Failed to fetch consolidator details for product ${item.product_id}`);
                        const cdData = await cdRes.json();
                        if (!cdData.data || cdData.data.length === 0) {
                            throw new Error(`Missing consolidator_details row for consolidator ${consolidatorId}, product ${item.product_id}`);
                        }

                        const cdRecord = cdData.data[0];
                        const currentApplied = cdRecord.applied_quantity || 0;
                        const newApplied = currentApplied + item.qty;

                        updatedConsolidatorDetails.push({ cdRecordId: cdRecord.id, originalQty: currentApplied });

                        const updateCdRes = await fetch(`${DIRECTUS_BASE}/items/consolidator_details/${cdRecord.id}`, {
                            method: "PATCH",
                            headers: directusHeaders(),
                            body: JSON.stringify({ applied_quantity: newApplied })
                        });
                        if (!updateCdRes.ok) throw new Error(`Failed to update consolidator detail ${cdRecord.id}: ${await updateCdRes.text()}`);
                        results.consolidatorDetailsUpdated++;
                    }
                }
            }

            if (results.invoicesCreated !== expectedReceiptCount) {
                throw new Error(`Invoice write count mismatch. Expected ${expectedReceiptCount}, wrote ${results.invoicesCreated}.`);
            }
            if (results.createdInvoices.length !== expectedReceiptCount) {
                throw new Error(`Created invoice ID count mismatch. Expected ${expectedReceiptCount}, got ${results.createdInvoices.length}.`);
            }
            if (results.invoiceDetailsCreated !== expectedItemCount) {
                throw new Error(`Invoice detail count mismatch. Expected ${expectedItemCount}, wrote ${results.invoiceDetailsCreated}.`);
            }
            if (results.orderDetailsUpdated !== expectedItemCount) {
                throw new Error(`Sales order detail update count mismatch. Expected ${expectedItemCount}, updated ${results.orderDetailsUpdated}.`);
            }
            if (results.consolidatorDetailsUpdated !== expectedItemCount) {
                throw new Error(`Consolidator detail update count mismatch. Expected ${expectedItemCount}, updated ${results.consolidatorDetailsUpdated}.`);
            }

            return NextResponse.json({ success: true, details: results }, { status: 200 });
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error("[Invoicing Transaction Failed] Starting rollback...", errorMessage);

            if (salesOrderWasUpdated) {
                try {
                    await fetch(`${DIRECTUS_BASE}/items/sales_order/${order.order_id}`, {
                        method: "PATCH",
                        headers: directusHeaders(),
                        body: JSON.stringify({
                            order_status: order.order_status,
                            for_loading_at: order.for_loading_at || null
                        })
                    });
                } catch (e) {
                    console.error("[Rollback Failed] sales_order status restore:", e);
                }
            }

            for (const invId of newlyCreatedInvoiceIds) {
                try {
                    await fetch(`${DIRECTUS_BASE}/items/sales_invoice_details?filter[invoice_no][_eq]=${invId}`, {
                        method: "DELETE",
                        headers: directusHeaders()
                    });
                    await fetch(`${DIRECTUS_BASE}/items/sales_invoice/${invId}`, {
                        method: "DELETE",
                        headers: directusHeaders()
                    });
                } catch (e) {
                    console.error("[Rollback Failed] sales_invoice deletion for ID:", invId, e);
                }
            }

            for (const detail of updatedSalesOrderDetails) {
                try {
                    await fetch(`${DIRECTUS_BASE}/items/sales_order_details/${detail.detailId}`, {
                        method: "PATCH",
                        headers: directusHeaders(),
                        body: JSON.stringify({ served_quantity: detail.originalQty })
                    });
                } catch (e) {
                    console.error("[Rollback Failed] sales_order_details served_quantity restore for ID:", detail.detailId, e);
                }
            }

            for (const cdDetail of updatedConsolidatorDetails) {
                try {
                    await fetch(`${DIRECTUS_BASE}/items/consolidator_details/${cdDetail.cdRecordId}`, {
                        method: "PATCH",
                        headers: directusHeaders(),
                        body: JSON.stringify({ applied_quantity: cdDetail.originalQty })
                    });
                } catch (e) {
                    console.error("[Rollback Failed] consolidator_details applied_quantity restore for ID:", cdDetail.cdRecordId, e);
                }
            }

            results.errors.push({ step: "transaction_rollback", error: errorMessage });
            return NextResponse.json({ error: errorMessage, details: results }, { status: 500 });
        }
    } catch (err: unknown) {
        return NextResponse.json({ error: "Internal Server Error", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
