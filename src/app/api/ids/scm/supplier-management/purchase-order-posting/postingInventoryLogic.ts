export type DiscountLookup = Map<number, { name?: string; pct?: number }>;

type DiscountSource = string | number | Record<string, unknown> | null | undefined;

function toStr(v: unknown, fb = "") {
    if (v && typeof v === "object") {
        const obj = v as Record<string, unknown>;
        return toStr(obj.name ?? obj.discount_type ?? obj.discount_code ?? obj.value ?? fb);
    }
    const s = String(v ?? "").trim();
    return s ? s : fb;
}

function toNum(v: unknown): number {
    if (v && typeof v === "object") {
        const obj = v as Record<string, unknown>;
        return toNum(obj.id ?? obj.value ?? obj.product_id ?? obj.supplier_id ?? obj.branch_id ?? 0);
    }
    const s = String(v ?? "").replace(/,/g, "").trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}

function sourceId(source: DiscountSource): string {
    if (source && typeof source === "object") {
        const obj = source as Record<string, unknown>;
        return toStr(obj.id ?? obj.value ?? obj.discount_type);
    }
    return toStr(source);
}

function sourceLabel(source: DiscountSource): string {
    if (source && typeof source === "object") {
        const obj = source as Record<string, unknown>;
        return toStr(obj.discount_type ?? obj.name ?? obj.discount_code ?? obj.value);
    }

    const value = toStr(source);
    return Number.isFinite(Number(value)) ? "" : value;
}

export function resolvePostingDiscountContext({
    savedDiscountType,
    discountTypesMap,
    productSupplierDiscountType,
    poDiscountType,
}: {
    savedDiscountType?: DiscountSource;
    discountTypesMap?: DiscountLookup;
    productSupplierDiscountType?: DiscountSource;
    poDiscountType?: DiscountSource;
}): { discountTypeId?: string; discountLabel?: string } {
    const sources = [savedDiscountType, productSupplierDiscountType, poDiscountType];

    for (const source of sources) {
        const id = sourceId(source);
        if (!id) continue;

        const lookup = discountTypesMap?.get(toNum(id));
        const label = toStr(lookup?.name) || sourceLabel(source);
        if (!label) continue;

        return {
            discountTypeId: id,
            discountLabel: label,
        };
    }

    return {};
}

export function discountDisplayText({
    discountLabel,
    discountAmount,
    money,
}: {
    discountLabel?: string | null;
    discountAmount?: number | null;
    money: (value: number) => string;
}): string {
    const label = toStr(discountLabel);
    const amount = Number(discountAmount ?? 0);

    if (label && amount > 0) return `${label} ${money(amount)}`;
    if (label) return label;
    if (amount > 0) return money(amount);
    return "—";
}

export function formatTareWeightForCommit(value: unknown): string | null {
    if (value === null || value === undefined) return null;

    const raw = String(value).replace(/,/g, "").trim();
    if (!raw) return null;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return null;

    const n = Number(raw);
    if (!Number.isFinite(n)) return null;

    return raw;
}

type ReceivingMergeItem = {
    serial_no?: unknown;
    tare_weight?: unknown;
};

export function mergeReceivingItemsPreferSerialTare<T extends ReceivingMergeItem>(
    receivingItems: T[],
    receivingSerials: T[],
): T[] {
    const merged = [...receivingItems];
    const itemIndexBySerial = new Map<string, number>();

    merged.forEach((item, index) => {
        const key = toStr(item.serial_no).toUpperCase();
        if (key) itemIndexBySerial.set(key, index);
    });

    for (const serialItem of receivingSerials) {
        const key = toStr(serialItem.serial_no).toUpperCase();
        const duplicateIndex = key ? itemIndexBySerial.get(key) : undefined;

        if (duplicateIndex === undefined) {
            merged.push(serialItem);
            if (key) itemIndexBySerial.set(key, merged.length - 1);
            continue;
        }

        const serialTare = formatTareWeightForCommit(serialItem.tare_weight);
        if (serialTare !== null) {
            merged[duplicateIndex] = {
                ...merged[duplicateIndex],
                tare_weight: serialTare,
            };
        }
    }

    return merged;
}
