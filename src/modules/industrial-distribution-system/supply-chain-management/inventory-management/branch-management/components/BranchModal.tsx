// BranchModal.tsx
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { 
    Combobox,
    ComboboxInput,
    ComboboxContent,
    ComboboxList,
    ComboboxItem,
} from "@/components/ui/combobox";

import type { User, Province, City, Barangay, Branch, BranchAudit } from "../types";
import {
    fetchProvinces,
    fetchCities,
    fetchBarangays,
    saveBranch,
    updateBranch,
    fetchBranchUsers,
    fetchBranchAudit,
} from "../providers/fetchProvider";

/**
 * Validation schema for Branch registration and edits.
 * Includes format and length validation for Philippine contact numbers.
 */
const formSchema = z.object({
    branch_name: z.string().min(1, "Branch Name is required"),
    branch_code: z.string().min(1, "Branch Code is required"),
    branch_head: z.string().min(1, "Branch Head is required"),
    branch_description: z.string().min(1, "Branch Description is required"),
    phone_number: z
        .string()
        .min(1, "Contact Number is required")
        .regex(/^[+0-9\s\-()]+$/, "Invalid contact number format. Only numbers, +, -, (), and spaces are allowed.")
        .refine((val) => {
            const digits = val.replace(/\D/g, "");
            return digits.length >= 7 && digits.length <= 13;
        }, "Contact number must be between 7 and 13 digits (e.g. 09171234567 or (02) 8123-4567)"),
    state_province: z.string().min(1, "Province is required"),
    city: z.string().min(1, "City / Municipality is required"),
    brgy: z.string().min(1, "Barangay is required"),
    postal_code: z.string().min(1, "Zip Code is required"),
    isMoving: z.boolean(),
    isActive: z.boolean(),
});

interface BranchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingBranch?: Branch | null;
}

type FormValues = z.infer<typeof formSchema>;

const inputBase = "h-9 bg-background border-input transition-all";
const inputFocus =
    "outline-none focus:outline-none focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 " +
    "focus-visible:border-ring";

const textareaBase = "min-h-[80px] bg-background border-input transition-all";

const selectBase = "h-9 bg-background border-input transition-all";
const selectFocus =
    "outline-none focus:outline-none " +
    "focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
    "focus:border-ring";

interface SearchableSelectOption {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    value: string;
    onValueChange: (value: string) => void;
    options: SearchableSelectOption[];
    placeholder?: string;
    disabled?: boolean;
    loading?: boolean;
    emptyText?: string;
    className?: string;
}

/**
 * Reusable searchable combobox select with clear triggers, focus select,
 * and reliable query reset on blur/close.
 */
function SearchableSelect({
    value,
    onValueChange,
    options,
    placeholder = "Select...",
    disabled = false,
    loading = false,
    emptyText = "No options found.",
    className,
}: SearchableSelectProps) {
    const [query, setQuery] = React.useState("");
    const [open, setOpen] = React.useState(false);

    // Selected option label displayed when dropdown is closed
    const selectedOption = React.useMemo(
        () => options.find((o) => o.value.toLowerCase() === value.toLowerCase()),
        [options, value]
    );
    const selectedLabel = selectedOption?.label ?? "";

    // Reset filter query when dropdown closes so next open shows the entire list
    const handleOpenChange = React.useCallback((nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setQuery("");
        }
    }, []);

    // Filter options based on typed input
    const filteredOptions = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => o.label.toLowerCase().includes(q));
    }, [options, query]);

    return (
        <Combobox
            value={value}
            onValueChange={(val) => {
                onValueChange(val ?? "");
                setQuery("");
            }}
            open={open}
            onOpenChange={handleOpenChange}
            openOnInputClick
            disabled={disabled || loading}
        >
            <ComboboxInput
                placeholder={loading ? "Loading..." : placeholder}
                value={open ? query : selectedLabel}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={(e) => {
                    if (!open) setOpen(true);
                    (e.target as HTMLInputElement).select();
                }}
                disabled={disabled || loading}
                showTrigger
                showClear={!!value && !disabled && !loading}
                className={cn(selectBase, selectFocus, className)}
            />
            <ComboboxContent 
                className="z-[9999] min-w-[220px] max-h-[280px] overflow-hidden shadow-2xl bg-popover border border-white/10"
                onPointerDown={(e) => e.stopPropagation()}
            >
                <ComboboxList 
                    className="max-h-[260px] overflow-y-auto"
                    onWheel={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {loading ? (
                        <div className="py-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            Loading options...
                        </div>
                    ) : filteredOptions.length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground">
                            {emptyText}
                        </div>
                    ) : (
                        filteredOptions.map((opt) => (
                            <ComboboxItem 
                                key={opt.value} 
                                value={opt.value}
                                className="cursor-pointer text-xs py-2 px-3 hover:bg-primary/10 transition-colors"
                            >
                                {opt.label}
                            </ComboboxItem>
                        ))
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

function AuditField({ label, value }: { label: string; value: string }) {
    return (
        <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{label}</p>
            <p className="text-sm font-medium text-foreground/80 tabular-nums">{value}</p>
        </div>
    );
}

export function BranchModal({ isOpen, onClose, onSuccess, editingBranch }: BranchModalProps) {
    const [provinces, setProvinces] = React.useState<Province[]>([]);
    const [cities, setCities] = React.useState<City[]>([]);
    const [barangays, setBarangays] = React.useState<Barangay[]>([]);

    const [isLoadingProvinces, setIsLoadingProvinces] = React.useState(false);
    const [isLoadingCities, setIsLoadingCities] = React.useState(false);
    const [isLoadingBarangays, setIsLoadingBarangays] = React.useState(false);

    const [users, setUsers] = React.useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [audit, setAudit] = React.useState<BranchAudit | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            branch_name: "",
            branch_code: "",
            branch_head: "",
            branch_description: "",
            phone_number: "",
            state_province: "",
            city: "",
            brgy: "",
            postal_code: "",
            isMoving: false,
            isActive: true,
        },
    });

    // Top-level memoized options for all dropdowns to avoid hook execution order issues
    const userOptions = React.useMemo(() => {
        return users.map((u) => ({
            value: String(u.user_id),
            label: [u.user_fname, u.user_lname].filter(Boolean).join(" ").trim() || `User #${u.user_id}`,
        }));
    }, [users]);

    const provinceOptions = React.useMemo(() => {
        return provinces.map((p) => ({
            value: p.name,
            label: p.name,
        }));
    }, [provinces]);

    const cityOptions = React.useMemo(() => {
        return cities.map((c) => ({
            value: c.name,
            label: c.name,
        }));
    }, [cities]);

    const barangayOptions = React.useMemo(() => {
        return barangays.map((b) => ({
            value: b.name,
            label: b.name,
        }));
    }, [barangays]);

    // Fetch provinces when modal opens
    React.useEffect(() => {
        if (isOpen && provinces.length === 0) {
            setIsLoadingProvinces(true);
            fetchProvinces()
                .then(setProvinces)
                .finally(() => setIsLoadingProvinces(false));
        }
    }, [isOpen, provinces.length]);

    // Fetch managers when modal opens
    React.useEffect(() => {
        if (isOpen && users.length === 0) {
            setIsLoadingUsers(true);
            fetchBranchUsers()
                .then(setUsers)
                .catch(() => setUsers([]))
                .finally(() => setIsLoadingUsers(false));
        }
    }, [isOpen, users.length]);

    // Fetch audit trail for existing branch
    React.useEffect(() => {
        if (!isOpen || !editingBranch) {
            setAudit(null);
            return;
        }
        let cancelled = false;
        fetchBranchAudit(editingBranch.id)
            .then((data) => { if (!cancelled) setAudit(data); })
            .catch(() => { if (!cancelled) setAudit(null); });
        return () => { cancelled = true; };
    }, [isOpen, editingBranch]);

    // Initialise or reset form values strictly when modal opens or target editingBranch changes
    React.useEffect(() => {
        if (!isOpen) return;

        if (editingBranch) {
            const initialHead = editingBranch.branch_head != null ? String(editingBranch.branch_head) : "";
            form.reset({
                branch_name: editingBranch.branch_name || "",
                branch_code: editingBranch.branch_code || "",
                branch_head: initialHead,
                branch_description: editingBranch.branch_description || "",
                phone_number: editingBranch.phone_number || "",
                state_province: editingBranch.state_province || "",
                city: editingBranch.city || "",
                brgy: editingBranch.brgy || "",
                postal_code: editingBranch.postal_code || "",
                isMoving: editingBranch.isMoving === 1 || editingBranch.isMoving === true,
                isActive: editingBranch.isActive === 1 || editingBranch.isActive === true,
            });
        } else {
            form.reset({
                branch_name: "",
                branch_code: "",
                branch_head: "",
                branch_description: "",
                phone_number: "",
                state_province: "",
                city: "",
                brgy: "",
                postal_code: "",
                isMoving: false,
                isActive: true,
            });
            setCities([]);
            setBarangays([]);
        }
    }, [isOpen, editingBranch, form]);

    // Pre-populate cities and barangays cascade for an existing branch being edited
    React.useEffect(() => {
        if (!isOpen || !editingBranch || provinces.length === 0) return;

        let cancelled = false;
        const loadLocationCascade = async () => {
            const currentProvinceName = editingBranch.state_province;
            if (!currentProvinceName) return;

            const provObj = provinces.find(
                (p) => p.name.toLowerCase() === currentProvinceName.toLowerCase()
            );
            if (!provObj) return;

            setIsLoadingCities(true);
            try {
                const cityData = await fetchCities(provObj.code);
                if (cancelled) return;
                setCities(cityData);

                const currentCityName = editingBranch.city;
                if (!currentCityName) return;

                const cityObj = cityData.find(
                    (c) => c.name.toLowerCase() === currentCityName.toLowerCase()
                );
                if (!cityObj) return;

                setIsLoadingBarangays(true);
                try {
                    const brgyData = await fetchBarangays(cityObj.code);
                    if (cancelled) return;
                    setBarangays(brgyData);
                } finally {
                    if (!cancelled) setIsLoadingBarangays(false);
                }
            } finally {
                if (!cancelled) setIsLoadingCities(false);
            }
        };

        loadLocationCascade();
        return () => {
            cancelled = true;
        };
    }, [isOpen, editingBranch, provinces]);

    // Handle Province selection -> load corresponding cities
    const onProvinceChange = async (provinceName: string) => {
        form.setValue("state_province", provinceName, { shouldValidate: true, shouldDirty: true });
        form.setValue("city", "", { shouldValidate: true, shouldDirty: true });
        form.setValue("brgy", "", { shouldValidate: true, shouldDirty: true });
        form.setValue("postal_code", "", { shouldValidate: true, shouldDirty: true });
        setCities([]);
        setBarangays([]);

        if (!provinceName) return;

        const prov = provinces.find((p) => p.name.toLowerCase() === provinceName.toLowerCase());
        if (!prov) return;

        setIsLoadingCities(true);
        try {
            const data = await fetchCities(prov.code);
            setCities(data);
        } finally {
            setIsLoadingCities(false);
        }
    };

    // Handle City selection -> load corresponding barangays
    const onCityChange = async (cityName: string) => {
        form.setValue("city", cityName, { shouldValidate: true, shouldDirty: true });
        form.setValue("brgy", "", { shouldValidate: true, shouldDirty: true });
        form.setValue("postal_code", "", { shouldValidate: true, shouldDirty: true });
        setBarangays([]);

        if (!cityName) return;

        const cityObj = cities.find((c) => c.name.toLowerCase() === cityName.toLowerCase());
        if (!cityObj) return;

        setIsLoadingBarangays(true);
        try {
            const data = await fetchBarangays(cityObj.code);
            setBarangays(data);
        } finally {
            setIsLoadingBarangays(false);
        }
    };

    // Handle Barangay selection
    const onBarangayChange = (barangayName: string) => {
        form.setValue("brgy", barangayName, { shouldValidate: true, shouldDirty: true });
    };

    const formatAuditTime = (value: string | null) => (value ? value.replace("T", " ").slice(0, 19) : "—");
    const formatAuditUser = (id: number | null) => {
        if (id === null || id === undefined) return "—";
        const user = users.find((u) => u.user_id === id);
        return user ? [user.user_fname, user.user_lname].filter(Boolean).join(" ").trim() || `User #${id}` : `User #${id}`;
    };

    async function onSubmit(values: FormValues) {
        setIsSubmitting(true);
        try {
            // Resolve numeric branch head ID
            let branchHeadId = parseInt(values.branch_head, 10);
            if (isNaN(branchHeadId) || branchHeadId <= 0) {
                const found = users.find(
                    (u) => [u.user_fname, u.user_lname].filter(Boolean).join(" ").trim() === values.branch_head
                );
                branchHeadId = found ? found.user_id : 0;
            }

            if (!branchHeadId) {
                toast.error("Please select a valid Branch Head");
                setIsSubmitting(false);
                return;
            }

            if (editingBranch) {
                await updateBranch(editingBranch.id, {
                    ...values,
                    branch_head: branchHeadId,
                });
                toast.success("Branch updated successfully!");
            } else {
                await saveBranch({
                    ...values,
                    branch_head: branchHeadId,
                });
                toast.success("Branch registered successfully!");
            }
            onSuccess();
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : `Failed to ${editingBranch ? "update" : "register"} branch`);
        } finally {
            setIsSubmitting(false);
        }
    }

    const onInvalid = (errors: import("react-hook-form").FieldErrors<FormValues>) => {
        const messages = Object.values(errors)
            .map((err) => err?.message)
            .filter(Boolean);

        if (messages.length > 0) {
            const uniqueMessages = Array.from(new Set(messages));
            uniqueMessages.forEach((msg) => toast.error(msg as string));
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[95vw] md:max-w-[800px] bg-background border-white/10 shadow-2xl p-0 flex flex-col gap-0 overflow-hidden outline-none">
                <DialogHeader className="px-6 py-4 border-b bg-muted/30">
                    <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        {editingBranch ? "Edit Branch" : "Add New Branch"}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto max-h-[80vh] bg-background">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="p-6 space-y-6">
                            {/* Branch Identity Section */}
                            <div className="bg-card p-5 rounded-lg border dark:border-white/10 shadow-sm space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary/80">
                                        Branch Information
                                    </h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="branch_name"
                                        render={({ field }) => (
                                            <FormItem className="space-y-1.5">
                                                <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                    Branch Name *
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="e.g. Manila Main Office"
                                                        {...field}
                                                        className={cn(inputBase, inputFocus)}
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="branch_code"
                                        render={({ field }) => (
                                            <FormItem className="space-y-1.5">
                                                <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                    Branch Code *
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="e.g. MLO-001"
                                                        {...field}
                                                        className={cn(inputBase, inputFocus)}
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="branch_head"
                                        render={({ field }) => (
                                            <FormItem className="space-y-1.5">
                                                <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                    Branch Head *
                                                </FormLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                        options={userOptions}
                                                        placeholder="Assign a manager"
                                                        loading={isLoadingUsers}
                                                        emptyText="No managers found."
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="phone_number"
                                        render={({ field }) => (
                                            <FormItem className="space-y-1.5">
                                                <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                    Contact Number *
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="e.g. 09171234567 or (02) 8123-4567"
                                                        {...field}
                                                        onChange={(e) => {
                                                            // Sanitize contact number input
                                                            const sanitized = e.target.value.replace(/[^0-9+\s\-()]/g, "");
                                                            field.onChange(sanitized);
                                                        }}
                                                        className={cn(inputBase, inputFocus)}
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="md:col-span-2">
                                        <FormField
                                            control={form.control}
                                            name="branch_description"
                                            render={({ field }) => (
                                                <FormItem className="space-y-1.5">
                                                    <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                        Branch Description *
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Brief overview of the branch"
                                                            {...field}
                                                            className={cn(textareaBase, inputFocus)}
                                                        />
                                                    </FormControl>
                                                    <FormMessage className="text-[10px]" />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Location Section */}
                            <div className="bg-card p-5 rounded-lg border dark:border-white/10 shadow-sm space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary/80">
                                        Location Details
                                    </h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="state_province"
                                        render={({ field }) => (
                                            <FormItem className="space-y-1.5">
                                                <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                    Province *
                                                </FormLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        value={field.value}
                                                        onValueChange={onProvinceChange}
                                                        options={provinceOptions}
                                                        placeholder="Select Province"
                                                        loading={isLoadingProvinces}
                                                        emptyText="No provinces found."
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="city"
                                        render={({ field }) => (
                                            <FormItem className="space-y-1.5">
                                                <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                    City / Municipality *
                                                </FormLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        value={field.value}
                                                        onValueChange={onCityChange}
                                                        options={cityOptions}
                                                        placeholder={
                                                            !form.watch("state_province")
                                                                ? "Select Province first"
                                                                : isLoadingCities
                                                                ? "Loading cities..."
                                                                : "Select City / Municipality"
                                                        }
                                                        disabled={!form.watch("state_province") || isLoadingCities}
                                                        loading={isLoadingCities}
                                                        emptyText="No cities found."
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="brgy"
                                        render={({ field }) => (
                                            <FormItem className="space-y-1.5">
                                                <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                    Barangay *
                                                </FormLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        value={field.value}
                                                        onValueChange={onBarangayChange}
                                                        options={barangayOptions}
                                                        placeholder={
                                                            !form.watch("city")
                                                                ? "Select City first"
                                                                : isLoadingBarangays
                                                                ? "Loading barangays..."
                                                                : "Select Barangay"
                                                        }
                                                        disabled={!form.watch("city") || isLoadingBarangays}
                                                        loading={isLoadingBarangays}
                                                        emptyText="No barangays found."
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="postal_code"
                                        render={({ field }) => (
                                            <FormItem className="space-y-1.5">
                                                <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                    Zip Code *
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Enter zip code"
                                                        {...field}
                                                        className={cn(inputBase, inputFocus)}
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Status Section */}
                            <div className="flex items-center gap-6 px-1">
                                <FormField
                                    control={form.control}
                                    name="isMoving"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-2.5 space-y-0">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    className="data-[state=checked]:bg-primary"
                                                />
                                            </FormControl>
                                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 cursor-pointer">
                                                is Moving?
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="isActive"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-2.5 space-y-0">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    className="data-[state=checked]:bg-primary"
                                                />
                                            </FormControl>
                                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 cursor-pointer">
                                                is Active?
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Audit Trail — existing records only */}
                            {editingBranch && (
                                <div className="bg-card p-5 rounded-lg border dark:border-white/10 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-primary/80">
                                            Audit Trail
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <AuditField label="Created By" value={formatAuditUser(audit?.created_by ?? null)} />
                                        <AuditField label="Created At (PH time)" value={formatAuditTime(audit?.created_at ?? null)} />
                                        <AuditField label="Last Updated By" value={formatAuditUser(audit?.updated_by ?? null)} />
                                        <AuditField label="Last Updated At (PH time)" value={formatAuditTime(audit?.updated_at ?? null)} />
                                    </div>
                                </div>
                            )}
                        </form>
                    </Form>
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-muted/50 sm:justify-between items-center gap-4">
                    <p className="hidden sm:block text-[10px] text-muted-foreground/60 italic">
                        Note: This will create both standard and bad stock records.
                    </p>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            className="flex-1 sm:flex-none h-9 text-xs font-semibold hover:bg-muted transition-colors"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            onClick={form.handleSubmit(onSubmit, onInvalid)}
                            disabled={isSubmitting}
                            className="flex-1 sm:flex-none h-9 text-xs font-bold min-w-[140px] shadow-lg shadow-primary/20"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    {editingBranch ? "Updating..." : "Registering..."}
                                </>
                            ) : (
                                editingBranch ? "Update Branch" : "Register Branch"
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
