export function formatMoney(amount: number, currency = "PHP") {
    try {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency,
            maximumFractionDigits: 2,
        }).format(Number(amount || 0));
    } catch {
        // fallback
        return `₱${Number(amount || 0).toFixed(2)}`;
    }
}

export function formatDate(dateISO: string) {
    try {
        if (!dateISO) return "";
        let iso = dateISO.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
            iso = `${iso}T00:00:00Z`;
        } else if (!iso.endsWith("Z") && !iso.includes("+") && !iso.includes("-", 10)) {
            iso = iso.replace(" ", "T") + "Z";
        }
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return dateISO;
        return d.toLocaleDateString("en-US", { timeZone: "Asia/Manila" });
    } catch {
        return dateISO;
    }
}

export function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
}
