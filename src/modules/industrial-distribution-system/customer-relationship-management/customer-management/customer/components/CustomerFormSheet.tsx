"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CreditCard,
  Loader2,
  Users,
  Building2,
  MapPin,
  Receipt,
  Check,
  ChevronsUpDown,
  Plus,
  AlertCircle,
  ArrowRight,
  UploadCloud,
} from "lucide-react";
import { useForm, useWatch, Resolver, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Textarea } from "@/components/ui/textarea";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
// Popover components were unused in this sheet — removed to satisfy linter
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CustomerWithRelations, PaymentTerm, ReferenceOption } from "../types";
import { BankAccountManager } from "./BankAccountManager";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface LocationOption {
  code: string;
  name: string;
}

interface SearchableComboboxProps {
  items: LocationOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  isLoading?: boolean;
}

// ============================================================================
// 🚀 IMAGE PREVIEW HELPER
// ============================================================================
const renderImagePreview = (imageId: string | null | undefined) => {
  if (!imageId || imageId.trim() === "") return null;

  const isUrl = imageId.startsWith("http");
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055";
  const imageUrl = isUrl ? imageId : `${baseUrl}/assets/${imageId}`;

  return (
    <div className="mt-4 relative w-full sm:w-62.5 aspect-video rounded-xl overflow-hidden border border-border shadow-sm group bg-muted/30">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Customer/Store Preview"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            "https://placehold.co/400x300/e2e8f0/64748b?text=Image+Not+Found";
        }}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2 pt-6">
        <p className="text-[9px] font-black uppercase tracking-widest text-white truncate">
          Store Image
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// FIELD COMBOBOX — DropdownMenu + sticky search + scrollable items (+ optional create)
// ============================================================================
interface FieldComboboxProps {
  items: ReferenceOption[];
  value: number | string | null | undefined;
  onChange: (value: number | string) => void;
  onCreate?: (name: string) => void;
  placeholder: string;
  itemName: string;
  disabled?: boolean;
}

function FieldCombobox({
  items = [],
  value,
  onChange,
  onCreate,
  placeholder,
  itemName,
  disabled,
}: FieldComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const selectedItem = useMemo(() => {
    if (!value) return undefined;
    return items.find((i) => String(i.id) === String(value));
  }, [items, value]);

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return items;
    return items.filter((i) => i.name.toLowerCase().includes(normalizedQuery));
  }, [items, normalizedQuery]);

  const hasExactMatch = filteredItems.some(
    (i) => i.name.toLowerCase() === normalizedQuery,
  );
  const showCreate = !!onCreate && normalizedQuery.length > 0 && !hasExactMatch;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
    if (next) setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (id: number | string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const handleCreate = () => {
    const trimmed = query.trim();
    if (!trimmed || !onCreate) return;
    onCreate(trimmed);
    setOpen(false);
    setQuery("");
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <FormControl>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full h-11 justify-between bg-muted/30",
              !value && "text-muted-foreground",
            )}
          >
            <span className="truncate">
              {selectedItem?.name ?? placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </FormControl>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-75 mb-3  p-0 shadow-xl rounded-xl"
        align="start"
        sideOffset={6}
      >
        {/* Sticky search */}
        <div className="flex items-center border-b px-3 sticky top-0 bg-popover z-10">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={`Search ${itemName}...`}
            className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {/* Items — DropdownMenuContent handles overflow-y-auto */}
        {filteredItems.length === 0 && !showCreate && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No {itemName} found.
          </div>
        )}
        {filteredItems.map((item) => (
          <DropdownMenuItem
            key={String(item.id)}
            onSelect={() => handleSelect(item.id)}
            className={cn(
              "cursor-pointer px-3 py-2",
              String(value) === String(item.id) && "bg-accent/50 font-medium",
            )}
          >
            <Check
              className={cn(
                "mr-2 h-4 w-4 text-primary shrink-0",
                String(value) === String(item.id) ? "opacity-100" : "opacity-0",
              )}
            />
            {item.name}
          </DropdownMenuItem>
        ))}
        {showCreate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={handleCreate}
              className="cursor-pointer px-3 py-2 text-primary font-semibold"
            >
              <Plus className="mr-2 h-4 w-4 shrink-0" />
              Create &quot;{query}&quot;
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// API-DRIVEN SEARCHABLE COMBOBOX (for geographic cascades)
// ============================================================================
function SearchableCombobox({
  items,
  value,
  onChange,
  placeholder,
  disabled,
  isLoading,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter((i) =>
      i.name.toLowerCase().includes(query.trim().toLowerCase()),
    );
  }, [items, query]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
    if (next) setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <FormControl>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className={cn(
              "w-full h-11 justify-between bg-muted/30",
              !value && "text-muted-foreground",
              (disabled || isLoading) && "opacity-50 cursor-not-allowed",
            )}
          >
            <div className="flex items-center truncate">
              {isLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {value ? value : isLoading ? "Fetching..." : placeholder}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </FormControl>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[320px] p-0 shadow-xl rounded-xl"
        align="start"
        sideOffset={6}
      >
        {/* Sticky search */}
        <div className="flex items-center border-b px-3 sticky top-0 bg-popover z-10">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search..."
            className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {filteredItems.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No results found.
          </div>
        )}
        {filteredItems.map((item, index) => (
          <DropdownMenuItem
            key={item.code || `${item.name}-${index}`}
            onSelect={() => {
              onChange(item.name);
              setOpen(false);
              setQuery("");
            }}
            className={cn(
              "cursor-pointer px-3 py-2",
              value === item.name && "bg-accent/50 font-medium",
            )}
          >
            <Check
              className={cn(
                "mr-2 h-4 w-4 text-primary shrink-0",
                value === item.name ? "opacity-100" : "opacity-0",
              )}
            />
            {item.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// SCHEMA & TYPES
// ============================================================================

const isWalkInClassification = (
  classificationId: number | string | null | undefined,
  options: ReferenceOption[],
) => {
  if (!classificationId) return false;
  const match = options.find((o) => String(o.id) === String(classificationId));
  const name = (match?.name || "").toLowerCase();
  return name.includes("walk");
};

const isHouseholdStoreType = (
  storeTypeId: number | string | null | undefined,
  options: ReferenceOption[],
) => {
  if (!storeTypeId) return false;
  const match = options.find((o) => String(o.id) === String(storeTypeId));
  const name = (match?.name || "").toLowerCase();
  return name.includes("household");
};

const customerSchema = z.object({
  customer_code: z.string().optional().or(z.literal("")),
  customer_name: z.string().min(1, "Customer name is required"),
  store_name: z.string().optional().or(z.literal("")),
  store_signage: z.string().optional().or(z.literal("")),
  contact_number: z
    .string()
    .regex(/^\d{11}$/, "Contact number must be exactly 11 digits"),
  customer_email: z.string().email().or(z.literal("")),
  brgy: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  province: z.string().optional().or(z.literal("")),
  type: z.enum(["Regular", "Employee"]),
  user_id: z.coerce.number().nullable(),
  tel_number: z.string(),
  customer_tin: z.string(),
  payment_term: z.coerce.number(),
  store_type: z.coerce.number().nullable(),
  classification: z.coerce.number().nullable(),
  price_type: z.string(),
  discount_type: z.coerce.number().nullable(),
  encoder_id: z.number(),
  isActive: z.coerce.number().default(1),
  isVAT: z.coerce.number().default(0),
  isEWT: z.coerce.number().default(0),
  status: z.enum(["Draft", "Active", "Suspended", "Archive"]).default("Draft"),
  customer_image: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  otherDetails: z.string().optional().nullable(),
  bank_accounts: z
    .array(
      z.object({
        id: z.number().optional(),
        customer_id: z.number().optional(),
        bank_name: z.coerce.number(),
        account_name: z.string().min(1, "Account name is required"),
        account_number: z.string().min(1, "Account number is required"),
        account_type: z.enum(["Savings", "Checking", "Other"]),
        branch_of_account: z.string().optional().nullable(),
        is_primary: z.coerce.number().default(0),
        notes: z.string().optional().nullable(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
      }),
    )
    .default([]),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

const PROFILE_STATUS_OPTIONS = [
  { value: "Draft", label: "Draft", description: "Pending Verification" },
  { value: "Active", label: "Active", description: "Fully Verified" },
  { value: "Suspended", label: "Suspended", description: "Account on Hold" },
  { value: "Archive", label: "Archive", description: "No longer active" },
];

const mapStatus = (s?: string | null) => {
  if (!s) return "Draft";
  const lower = s.toLowerCase();
  if (lower.includes("active")) return "Active";
  if (lower.includes("suspend")) return "Suspended";
  if (lower.includes("archive")) return "Archive";
  return "Draft";
};

interface CustomerFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerWithRelations | null;
  onSubmit: (data: CustomerFormValues) => Promise<void>;
  defaultTab?: string;
}

const getDefaultValues = (): CustomerFormValues => ({
  customer_code: "",
  customer_name: "",
  store_name: "",
  store_signage: "",
  contact_number: "",
  customer_email: "",
  brgy: "",
  city: "",
  province: "",
  tel_number: "",
  customer_tin: "",
  payment_term: 0,
  store_type: null,
  classification: null,
  price_type: "",
  isActive: 1,
  isVAT: 0,
  isEWT: 0,
  discount_type: null,
  type: "Regular",
  user_id: null,
  encoder_id: 1,
  bank_accounts: [],
  customer_image: "",
  location: "",
  otherDetails: "",
  status: "Active",
});

// ============================================================================
// 🚀 MAP HELPER COMPONENT
// ============================================================================
const renderMap = (locationString: string | null | undefined) => {
  if (!locationString) {
    return (
      <div className="w-full h-62.5 bg-muted/30 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground">
        <MapPin className="h-8 w-8 mb-2 opacity-20" />
        <span className="text-xs font-bold uppercase tracking-widest">
          No Geo-Tag Available
        </span>
      </div>
    );
  }

  const [lat, lon] = locationString.split(",").map((s) => s.trim());

  return (
    <div className="w-full rounded-xl border border-border shadow-inner overflow-hidden relative group mt-4">
      <iframe
        width="100%"
        height="250"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={`https://maps.google.com/maps?q=${lat},${lon}&z=16&output=embed`}
      ></iframe>
      <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-border shadow-sm flex items-center gap-1.5 pointer-events-none">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[9px] font-black uppercase tracking-widest text-foreground">
          Live Location
        </span>
      </div>
    </div>
  );
};

function TabBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Badge
      variant="destructive"
      className="ml-2 h-4 w-4 p-0 flex items-center justify-center text-[10px] animate-in zoom-in"
    >
      {count}
    </Badge>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function CustomerFormSheet({
  open,
  onOpenChange,
  customer,
  onSubmit,
  defaultTab = "basic",
}: CustomerFormSheetProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [storeTypes, setStoreTypes] = useState<ReferenceOption[]>([]);
  const [classifications, setClassifications] = useState<ReferenceOption[]>([]);
  const [statuses, setStatuses] = useState<ReferenceOption[]>(() =>
    PROFILE_STATUS_OPTIONS.map((opt) => ({ id: opt.value, name: opt.label })),
  );
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [bankNames, setBankNames] = useState<ReferenceOption[]>([]);
  const [priceTypes, setPriceTypes] = useState<{ price_type_id: number; price_type_name: string; sort?: number }[]>([]);
  const [isLoadingPriceTypes, setIsLoadingPriceTypes] = useState(false);

  const [provincesList, setProvincesList] = useState<LocationOption[]>([]);
  const [citiesList, setCitiesList] = useState<LocationOption[]>([]);
  const [barangaysList, setBarangaysList] = useState<LocationOption[]>([]);

  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);
  const [isLoadingPaymentTerms, setIsLoadingPaymentTerms] = useState(false);
  const [isLoadingBankNames, setIsLoadingBankNames] = useState(false);

  // 🚀 STATES FOR NEW FEATURES
  const [isUploading, setIsUploading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema) as Resolver<CustomerFormValues>,
    defaultValues: getDefaultValues(),
  });

  const selectedProvince = useWatch({
    control: form.control,
    name: "province",
  });
  const selectedCity = useWatch({ control: form.control, name: "city" });
  const selectedClassificationId = useWatch({
    control: form.control,
    name: "classification",
  });
  const selectedStoreTypeId = useWatch({
    control: form.control,
    name: "store_type",
  });
  const watchedBankAccounts = useWatch({
    control: form.control,
    name: "bank_accounts",
  });

  const isWalkIn = useMemo(() => {
    return isWalkInClassification(selectedClassificationId, classifications);
  }, [selectedClassificationId, classifications]);

  const isHousehold = useMemo(() => {
    return isHouseholdStoreType(selectedStoreTypeId, storeTypes);
  }, [selectedStoreTypeId, storeTypes]);

  const isWalkInOrHousehold = isWalkIn || isHousehold;

  // 🚀 REMOVED: Automatic enforcement of status/classification
  // We keep the logic for price_type as a default but won't force it on every change if already set
  useEffect(() => {
    if (isWalkInOrHousehold) {
      const currentPriceType = form.getValues("price_type");
      if (!currentPriceType) {
        form.setValue("price_type", "E", { shouldValidate: true });
      }
    }
  }, [isWalkInOrHousehold, form]);

  // ========================================================================
  // 🚀 NEW FEATURE: AUTOMATIC IMAGE UPLOAD
  // ========================================================================
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Calls a Next.js endpoint that forwards the file to Directus
      const res = await fetch("/api/ids/crm/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      // Instantly fill the input with the returned Directus UUID
      form.setValue("customer_image", data.id || data.data?.id, {
        shouldValidate: true,
      });
      toast.success("Image uploaded successfully!");
    } catch {
      toast.error(
        "Failed to upload image. Please ensure the /api/ids/crm/upload endpoint exists.",
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input
    }
  };

  // ========================================================================
  // 🚀 NEW FEATURE: REVERSE GEOCODING (Coordinates -> Address)
  // ========================================================================
  const handleAutoFillAddress = async () => {
    const loc = form.getValues("location");
    if (!loc) {
      toast.error("Please enter coordinates first (Lat, Lon)");
      return;
    }

    const coords = loc.split(",");
    if (coords.length !== 2) {
      toast.error("Invalid format. Please use 'Lat, Lon'");
      return;
    }

    setIsGeocoding(true);
    try {
      const lat = coords[0].trim();
      const lon = coords[1].trim();

      // Ping the free OpenStreetMap Reverse Geocoding API
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      );
      const data = await res.json();

      if (data && data.address) {
        const address = data.address;
        // Attempt to map OSM location names to our form fields
        const province =
          address.province || address.state || address.region || "";
        const city = address.city || address.town || address.municipality || "";
        const brgy =
          address.suburb ||
          address.village ||
          address.neighbourhood ||
          address.quarter ||
          "";

        if (province)
          form.setValue("province", province, { shouldValidate: true });
        if (city) form.setValue("city", city, { shouldValidate: true });
        if (brgy) form.setValue("brgy", brgy, { shouldValidate: true });

        toast.success("Address auto-filled from map data!");
      } else {
        toast.error("Could not resolve address from these coordinates.");
      }
    } catch {
      toast.error("Failed to fetch address data from maps.");
    } finally {
      setIsGeocoding(false);
    }
  };

  // [Rest of your existing useEffects for PSGC & References...]
  useEffect(() => {
    if (!open) return;
    let isMounted = true;

    const fetchProvinces = async () => {
      setIsLoadingProvinces(true);
      try {
        const res = await fetch("https://psgc.gitlab.io/api/provinces/");
        if (!res.ok) throw new Error("Failed to fetch provinces");
        const data = await res.json();
        if (isMounted) {
          setProvincesList(
            data.map((p: { code: string; name: string }) => ({
              code: p.code,
              name: p.name,
            })),
          );
        }
      } catch {
        console.error("Failed to fetch provinces");
      } finally {
        if (isMounted) setIsLoadingProvinces(false);
      }
    };
    fetchProvinces();
    return () => {
      isMounted = false;
    };
  }, [open]);

  useEffect(() => {
    let isMounted = true;
    const fetchCities = async () => {
      if (!selectedProvince || provincesList.length === 0) {
        setCitiesList([]);
        return;
      }

      const provObj = provincesList.find((p) => p.name === selectedProvince);
      if (!provObj) return;

      setIsLoadingCities(true);
      try {
        const res = await fetch(
          `https://psgc.gitlab.io/api/provinces/${provObj.code}/cities-municipalities/`,
        );
        if (!res.ok) throw new Error("Failed to fetch cities");
        const data = await res.json();
        if (isMounted) {
          setCitiesList(
            data.map((c: { code: string; name: string }) => ({
              code: c.code,
              name: c.name,
            })),
          );
        }
      } catch {
        console.error("Failed to fetch provinces");
      } finally {
        if (isMounted) setIsLoadingCities(false);
      }
    };
    fetchCities();
    return () => {
      isMounted = false;
    };
  }, [selectedProvince, provincesList]);

  useEffect(() => {
    let isMounted = true;
    const fetchBarangays = async () => {
      if (!selectedCity || citiesList.length === 0) {
        setBarangaysList([]);
        return;
      }

      const cityObj = citiesList.find((c) => c.name === selectedCity);
      if (!cityObj) return;

      setIsLoadingBarangays(true);
      try {
        const res = await fetch(
          `https://psgc.gitlab.io/api/cities-municipalities/${cityObj.code}/barangays/`,
        );
        if (!res.ok) throw new Error("Failed to fetch barangays");
        const data = await res.json();
        if (isMounted) {
          setBarangaysList(
            data.map((b: { code: string; name: string }) => ({
              code: b.code,
              name: b.name,
            })),
          );
        }
      } catch {
        console.error("Failed to fetch provinces");
      } finally {
        if (isMounted) setIsLoadingBarangays(false);
      }
    };
    fetchBarangays();
    return () => {
      isMounted = false;
    };
  }, [selectedCity, citiesList]);

  useEffect(() => {
    if (isWalkInOrHousehold) {
      form.clearErrors(["customer_tin", "store_name", "store_signage"]);
    }
  }, [form, isWalkInOrHousehold]);

  useEffect(() => {
    let isMounted = true;
    const fetchRefs = async () => {
      try {
        const [storeRes, classRes] = await Promise.all([
          fetch("/api/ids/crm/customer/references?type=store_type"),
          fetch("/api/ids/crm/customer/references?type=classification"),
        ]);

        if (!isMounted) return;

        if (storeRes.ok) {
          const json = await storeRes.json();
          setStoreTypes(
            json.data?.map((item: { id: number; store_type: string }) => ({
              id: item.id,
              name: item.store_type,
            })) || [],
          );
        }

        if (classRes.ok) {
          const json = await classRes.json();
          setClassifications(
            json.data?.map(
              (item: { id: number; classification_name: string }) => ({
                id: item.id,
                name: item.classification_name,
              }),
            ) || [],
          );
        }
      } catch {
        if (isMounted) console.error("Failed to fetch references");
      }
    };

    if (open) {
      fetchRefs();
    }

    return () => {
      isMounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let isMounted = true;

    const fetchPaymentTerms = async () => {
      setIsLoadingPaymentTerms(true);
      try {
        const res = await fetch(
          "/api/ids/crm/customer/references?type=payment_term",
        );
        if (!res.ok) throw new Error("Failed to fetch payment terms");
        const json = await res.json();
        if (isMounted) {
          setPaymentTerms(json.data || []);
        }
      } catch {
        console.error("Failed to fetch payment terms");
      } finally {
        if (isMounted) setIsLoadingPaymentTerms(false);
      }
    };

    fetchPaymentTerms();
    return () => {
      isMounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let isMounted = true;

    const fetchPriceTypes = async () => {
      setIsLoadingPriceTypes(true);
      try {
        const res = await fetch("/api/ids/fm/product-pricing/price-types");
        if (!res.ok) throw new Error("Failed to fetch price types");
        const json = await res.json();
        if (isMounted) {
          setPriceTypes(json.data || []);
        }
      } catch {
        console.error("Failed to fetch price types");
      } finally {
        if (isMounted) setIsLoadingPriceTypes(false);
      }
    };

    fetchPriceTypes();
    return () => {
      isMounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let isMounted = true;

    const fetchBankNames = async () => {
      setIsLoadingBankNames(true);
      try {
        const res = await fetch(
          "/api/ids/crm/customer/references?type=bank_name",
        );
        if (!res.ok) throw new Error("Failed to fetch bank names");
        const json = await res.json();
        if (isMounted) {
          setBankNames(
            json.data?.map((item: { id: number; bank_name: string }) => ({
              id: item.id,
              name: item.bank_name,
            })) || [],
          );
        }
      } catch {
        console.error("Failed to fetch bank names");
      } finally {
        if (isMounted) setIsLoadingBankNames(false);
      }
    };

    fetchBankNames();
    return () => {
      isMounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      if (customer) {
        form.reset({
          ...customer,
          store_signage: customer.store_signage || "",
          customer_email: customer.customer_email || "",
          brgy: customer.brgy || "",
          city: customer.city || "",
          province: customer.province || "",
          tel_number: customer.tel_number || "",
          customer_tin: customer.customer_tin || "",
          payment_term: customer.payment_term || 0,
          store_type: customer.store_type || null,
          price_type: customer.price_type || "",
          isActive: customer.isActive ?? 1,
          isVAT: customer.isVAT ?? 0,
          isEWT: customer.isEWT ?? 0,
          status: mapStatus(customer.status || customer.profile_status),
          discount_type: customer.discount_type || null,
          type: customer.type || "Regular",
          user_id: customer.user_id || null,
          encoder_id: customer.encoder_id || 1,
          classification: customer.classification || null,
          bank_accounts: customer.bank_accounts || [],
          customer_image: customer.customer_image || "",
          location: customer.location ? String(customer.location) : "",
          otherDetails: customer.otherDetails || "",
        });
      } else {
        form.reset(getDefaultValues());
      }
    }
  }, [customer, form, open]);

  const handleFormSubmit: SubmitHandler<CustomerFormValues> = async (
    values,
  ) => {
    const walkInSelected = isWalkInClassification(
      values.classification,
      classifications,
    );
    const householdSelected = isHouseholdStoreType(
      values.store_type,
      storeTypes,
    );
    const walkInOrHousehold = walkInSelected || householdSelected;

    form.clearErrors([
      "customer_tin",
      "province",
      "city",
      "brgy",
      "store_name",
      "store_signage",
    ]);

    let hasManualErrors = false;
    let firstTab: "address" | "billing" | "basic" | null = null;

    if (!values.province || values.province.trim() === "") {
      form.setError("province", {
        type: "manual",
        message: "Province is required.",
      });
      firstTab = firstTab || "address";
      hasManualErrors = true;
    }

    if (!values.city || values.city.trim() === "") {
      form.setError("city", { type: "manual", message: "City is required." });
      firstTab = firstTab || "address";
      hasManualErrors = true;
    }

    if (!values.brgy || values.brgy.trim() === "") {
      form.setError("brgy", {
        type: "manual",
        message: "Barangay is required.",
      });
      firstTab = firstTab || "address";
      hasManualErrors = true;
    }

    if (!walkInOrHousehold) {
      if (!values.customer_tin || values.customer_tin.trim() === "") {
        form.setError("customer_tin", {
          type: "manual",
          message: "TIN is required for business accounts.",
        });
        firstTab = firstTab || "billing";
        hasManualErrors = true;
      }
      if (!values.store_name || values.store_name.trim() === "") {
        form.setError("store_name", {
          type: "manual",
          message: "Store Name is required for business accounts.",
        });
        firstTab = firstTab || "basic";
        hasManualErrors = true;
      }
      if (!values.store_signage || values.store_signage.trim() === "") {
        form.setError("store_signage", {
          type: "manual",
          message: "Store Signage is required for business accounts.",
        });
        firstTab = firstTab || "basic";
        hasManualErrors = true;
      }
    }

    if (hasManualErrors) {
      if (firstTab) setActiveTab(firstTab);
      toast.error("Please complete the required fields before saving.");
      return;
    }

    if (walkInOrHousehold) {
      const fullName = values.customer_name;
      const brgy = values.brgy || "";
      const city = values.city || "";
      const generatedName = `${fullName}, ${brgy}, ${city}`
        .replace(/^[,\s]+|[,\s]+$/g, "")
        .replace(/,\s*,/g, ",");

      values.store_name = generatedName;
      values.store_signage = generatedName;

      // Removed: aggressive overrides for price_type, status, and classification
      // These should be set via defaults or user selection, not forced here.
    }

    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch {
      toast.error("Failed to save customer. Please try again.");
    }
  };

  const tabErrorCounts = useMemo(() => {
    const errorKeys = Object.keys(form.formState.errors);
    if (errorKeys.length === 0) {
      return { basic: 0, address: 0, billing: 0, bank: 0 };
    }

    return {
      basic: errorKeys.filter((k) =>
        [
          "customer_code",
          "customer_name",
          "store_type",
          "classification",
          "status",
          "store_name",
          "store_signage",
        ].includes(k),
      ).length,
      address: errorKeys.filter((k) =>
        [
          "province",
          "city",
          "brgy",
          "contact_number",
          "tel_number",
          "customer_email",
        ].includes(k),
      ).length,
      billing: errorKeys.filter((k) =>
        [
          "customer_tin",
          "payment_term",
          "price_type",
          "isActive",
          "isVAT",
          "isEWT",
        ].includes(k),
      ).length,
      bank: form.formState.errors.bank_accounts ? 1 : 0,
    };
  }, [form.formState.errors]);

  const navigateToFirstError = () => {
    if (tabErrorCounts.basic > 0) setActiveTab("basic");
    else if (tabErrorCounts.address > 0) setActiveTab("address");
    else if (tabErrorCounts.billing > 0) setActiveTab("billing");
  };

  const hasExternalErrors =
    tabErrorCounts.basic > 0 ||
    tabErrorCounts.address > 0 ||
    tabErrorCounts.billing > 0;

  const onFormError = () => {
    toast.error("Please fill in all required fields in the highlighted tabs.");
  };

  const handleSheetOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setActiveTab(defaultTab);
    }
    onOpenChange(nextOpen);
  };

  // [handleCreateStoreType & handleCreateClassification omitted for brevity, they remain unchanged]
  const handleCreateStatus = async (name: string) => {
    // Profile status is a string enum/text field, so we just apply it locally
    setStatuses((prev) => [...prev, { id: name, name }]);
    // Cast via unknown to avoid using `any` while keeping permissive custom statuses
    form.setValue("status", name as unknown as CustomerFormValues["status"], {
      shouldValidate: true,
    });
    toast.success(`Custom status "${name}" applied.`);
  };

  const handleCreateStoreType = async (name: string) => {
    try {
      const res = await fetch("/api/ids/crm/customer/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "store_type", name }),
      });
      if (!res.ok) throw new Error("Failed to create store type");
      const json = await res.json();
      const newId = json.data.id;
      setStoreTypes((prev) => [...prev, { id: newId, name }]);
      form.setValue("store_type", newId, { shouldValidate: true });
      toast.success(`Store Type "${name}" created successfully!`);
    } catch {
      toast.error("Failed to create store type.");
    }
  };

  const handleCreateClassification = async (name: string) => {
    try {
      const res = await fetch("/api/ids/crm/customer/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "classification", name }),
      });
      if (!res.ok) throw new Error("Failed to create classification");
      const json = await res.json();
      const newId = json.data.id;
      setClassifications((prev) => [...prev, { id: newId, name }]);
      form.setValue("classification", newId, { shouldValidate: true });
      toast.success(`Classification "${name}" created successfully!`);
    } catch {
      toast.error("Failed to create classification.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl md:max-w-3xl p-0 flex flex-col bg-background shadow-2xl border-l-border/40">
        <div className="p-6 md:p-8 bg-muted/10 border-b border-border/50 shrink-0">
          <SheetHeader className="text-left">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner hidden sm:flex">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <SheetTitle className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic">
                  {customer ? "Edit Customer" : "New Customer"}
                </SheetTitle>
                <SheetDescription className="font-bold text-xs uppercase tracking-widest mt-1">
                  {customer
                    ? `Editing ID: ${customer.customer_code}`
                    : "Create a new customer profile"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit, onFormError)}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="px-6 md:px-8 pt-4 shrink-0 bg-background z-10 space-y-4">
                {defaultTab === "bank" && hasExternalErrors && (
                  <Alert
                    variant="destructive"
                    className="bg-destructive/5 border-destructive/20 animate-in slide-in-from-top-2 duration-300"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-sm font-black uppercase tracking-tight">
                      Profile Incomplete
                    </AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-4 mt-1">
                      <span className="text-xs font-bold leading-relaxed">
                        This customer has missing required information in other
                        sections. Please complete them to save changes.
                      </span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={navigateToFirstError}
                        className="h-8 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg shrink-0"
                      >
                        Fix Issues <ArrowRight className="ml-1.5 h-3 w-3" />
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/50 rounded-xl">
                  <TabsTrigger
                    value="basic"
                    disabled={
                      defaultTab === "bank" && tabErrorCounts.basic === 0
                    }
                    className="py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg flex items-center justify-center"
                  >
                    <Building2 className="w-3.5 h-3.5 mr-2 hidden md:block" />
                    Basic
                    <TabBadge count={tabErrorCounts.basic} />
                  </TabsTrigger>
                  <TabsTrigger
                    value="address"
                    disabled={
                      defaultTab === "bank" && tabErrorCounts.address === 0
                    }
                    className="py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg flex items-center justify-center"
                  >
                    <MapPin className="w-3.5 h-3.5 mr-2 hidden md:block" />
                    Location
                    <TabBadge count={tabErrorCounts.address} />
                  </TabsTrigger>
                  <TabsTrigger
                    value="billing"
                    disabled={
                      defaultTab === "bank" && tabErrorCounts.billing === 0
                    }
                    className="py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg flex items-center justify-center"
                  >
                    <Receipt className="w-3.5 h-3.5 mr-2 hidden md:block" />
                    Billing
                    <TabBadge count={tabErrorCounts.billing} />
                  </TabsTrigger>
                  <TabsTrigger
                    value="bank"
                    className="py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg flex items-center justify-center"
                  >
                    <CreditCard className="w-3.5 h-3.5 mr-2 hidden md:block" />
                    Bank
                    <TabBadge count={tabErrorCounts.bank} />
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1  overflow-y-auto custom-scrollbar p-6 md:p-8">
                <TabsContent
                  value="basic"
                  className="space-y-6 m-0 animate-in fade-in slide-in-from-bottom-2"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="customer_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Customer Code
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 bg-muted/30 cursor-not-allowed font-mono text-muted-foreground"
                              placeholder="AUTO-GENERATED"
                              disabled
                              {...field}
                              value={field.value || "AUTO-GENERATED"}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customer_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Customer Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 bg-muted/30"
                              placeholder="John Doe"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="store_type"
                      render={({ field }) => (
                        <FormItem className="flex flex-col h-20 pt-1.5">
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Store Type
                          </FormLabel>
                          <FieldCombobox
                            items={storeTypes}
                            value={field.value}
                            onChange={field.onChange}
                            onCreate={handleCreateStoreType}
                            placeholder="Select or create..."
                            itemName="Store Type"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="classification"
                      render={({ field }) => (
                        <FormItem className="flex flex-col pt-1.5">
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Classification
                          </FormLabel>
                          <FieldCombobox
                            items={classifications}
                            value={field.value}
                            onChange={field.onChange}
                            onCreate={handleCreateClassification}
                            placeholder="Select or create..."
                            itemName="Classification"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Profile Status
                          </FormLabel>
                          <FieldCombobox
                            items={statuses}
                            value={field.value}
                            onChange={field.onChange}
                            onCreate={handleCreateStatus}
                            placeholder="Select or create status..."
                            itemName="Status"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!isWalkInOrHousehold && (
                      <>
                        <FormField
                          control={form.control}
                          name="store_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                                Store Name
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="h-11 bg-muted/30"
                                  placeholder="Main Branch"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="store_signage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                                Store Signage
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="h-11 bg-muted/30"
                                  placeholder="Doe's General Store"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* 🚀 FIXED: Interactive Image Upload & Preview */}
                    <FormField
                      control={form.control}
                      name="customer_image"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Store / Customer Image (UUID or URL)
                          </FormLabel>
                          <div className="flex gap-2 items-center">
                            <FormControl>
                              <Input
                                className="h-11 bg-muted/30 font-mono text-xs flex-1"
                                placeholder="Paste Directus UUID or URL..."
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-11 px-4 border-dashed border-primary text-primary hover:bg-primary/10 transition-colors"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploading}
                            >
                              {isUploading ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <UploadCloud className="w-4 h-4 mr-2" />
                              )}
                              {isUploading ? "Uploading..." : "Upload File"}
                            </Button>
                            <input
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              accept="image/*"
                              onChange={handleImageUpload}
                            />
                          </div>
                          <FormMessage />
                          {renderImagePreview(field.value)}
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="otherDetails"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Remarks
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="bg-muted/30 min-h-25 resize-none"
                              placeholder="Additional customer remarks..."
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent
                  value="address"
                  className="space-y-6 m-0 animate-in fade-in slide-in-from-bottom-2"
                >
                  {isWalkIn && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-700 font-semibold">
                      Walk-in classification: Delivery address fields can be
                      left blank.
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="province"
                      render={({ field }) => (
                        <FormItem className="flex flex-col md:col-span-2">
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Province
                          </FormLabel>
                          <SearchableCombobox
                            items={provincesList}
                            value={field.value || ""}
                            isLoading={isLoadingProvinces}
                            onChange={(val: string) => {
                              field.onChange(val);
                              form.setValue("city", "", {
                                shouldValidate: true,
                              });
                              form.setValue("brgy", "", {
                                shouldValidate: true,
                              });
                            }}
                            placeholder="Search province..."
                            disabled={isLoadingProvinces}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            City / Municipality
                          </FormLabel>
                          <SearchableCombobox
                            items={citiesList}
                            value={field.value || ""}
                            isLoading={isLoadingCities}
                            onChange={(val: string) => {
                              field.onChange(val);
                              form.setValue("brgy", "", {
                                shouldValidate: true,
                              });
                            }}
                            placeholder={
                              selectedProvince
                                ? "Search city..."
                                : "Select province first"
                            }
                            disabled={!selectedProvince || isLoadingCities}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="brgy"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Barangay
                          </FormLabel>
                          <SearchableCombobox
                            items={barangaysList}
                            value={field.value || ""}
                            isLoading={isLoadingBarangays}
                            onChange={field.onChange}
                            placeholder={
                              selectedCity
                                ? "Search barangay..."
                                : "Select city first"
                            }
                            disabled={!selectedCity || isLoadingBarangays}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* 🚀 FIXED: Auto-Fill Address Button Added */}
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Geo Tag (Coordinates)
                          </FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                className="h-11 bg-muted/30 font-mono flex-1"
                                placeholder="e.g., 16.0433, 120.3333"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="secondary"
                              className="h-11 shadow-sm font-bold tracking-wide"
                              onClick={handleAutoFillAddress}
                              disabled={isGeocoding || !field.value}
                            >
                              {isGeocoding ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <MapPin className="w-4 h-4 mr-2 text-amber-500" />
                              )}
                              Auto-Fill Address
                            </Button>
                          </div>
                          <FormMessage />

                          <div className="mt-4">{renderMap(field.value)}</div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contact_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Mobile Number
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 bg-muted/30"
                              placeholder="09123456789"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tel_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Telephone Number
                          </FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-muted/30" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customer_email"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Email Address
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 bg-muted/30"
                              type="email"
                              placeholder="customer@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent
                  value="billing"
                  className="space-y-6 m-0 animate-in fade-in slide-in-from-bottom-2"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* PAYMENT TERM */}
                    <FormField
                      control={form.control}
                      name="payment_term"
                      rules={{ required: "Payment term is required" }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Payment Term
                          </FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={paymentTerms.map((t) => ({
                                value: String(t.id),
                                label: t.payment_name,
                              }))}
                              value={field.value ? String(field.value) : ""}
                              onValueChange={(val) =>
                                field.onChange(Number(val))
                              }
                              placeholder={
                                isLoadingPaymentTerms
                                  ? "Loading terms..."
                                  : "Select payment term"
                              }
                              disabled={isLoadingPaymentTerms}
                              className="h-11 bg-muted/30"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* PRICE TYPE */}
                    <FormField
                      control={form.control}
                      name="price_type"
                      rules={{ required: "Price type is required" }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Price Type
                          </FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={priceTypes.map((pt) => ({
                                value: pt.price_type_name,
                                label: pt.price_type_name,
                              }))}
                              value={field.value || ""}
                              onValueChange={field.onChange}
                              placeholder={
                                isLoadingPriceTypes
                                  ? "Loading price types..."
                                  : "Select price type"
                              }
                              disabled={isLoadingPriceTypes}
                              className="h-11 bg-muted/30"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div>
                    {/* CUSTOMER TIN */}
                    <FormField
                      control={form.control}
                      name="customer_tin"
                      rules={{
                        validate: (value) => {
                          if (!isWalkIn && !value) {
                            return "TIN is required for non walk-in customers";
                          }
                          return true;
                        },
                      }}
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="font-bold uppercase text-xs text-muted-foreground">
                            Business Registration No. (TIN)
                          </FormLabel>

                          <FormControl>
                            <Input
                              className="h-11 bg-muted/30 font-mono"
                              placeholder="000-000-000-00000"
                              value={field.value || ""}
                              onChange={(e) => {
                                const raw = e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 14);

                                const formatted = raw.replace(
                                  /^(\d{3})(\d{3})(\d{3})(\d{0,5}).*/,
                                  (_, a, b, c, d) =>
                                    [a, b, c, d].filter(Boolean).join("-"),
                                );

                                field.onChange(formatted);
                              }}
                            />
                          </FormControl>

                          {/* Dynamic Guidance */}
                          {!isWalkIn ? (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Required for all registered business customers.
                              Must be unique.
                            </p>
                          ) : (
                            <p className="text-[11px] text-amber-600 mt-1 font-semibold">
                              Walk-in classification: TIN is optional.
                            </p>
                          )}

                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="bg-muted/20 p-5 rounded-2xl border border-border/50 flex flex-col sm:flex-row gap-8 mt-6">
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value === 1}
                              onCheckedChange={(checked) =>
                                field.onChange(checked ? 1 : 0)
                              }
                              className="w-5 h-5 rounded-md"
                            />
                          </FormControl>
                          <FormLabel className="font-bold uppercase text-xs cursor-pointer">
                            Active Account
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isVAT"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value === 1}
                              onCheckedChange={(checked) =>
                                field.onChange(checked ? 1 : 0)
                              }
                              className="w-5 h-5 rounded-md"
                            />
                          </FormControl>
                          <FormLabel className="font-bold uppercase text-xs cursor-pointer">
                            VAT Registered
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isEWT"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value === 1}
                              onCheckedChange={(checked) =>
                                field.onChange(checked ? 1 : 0)
                              }
                              className="w-5 h-5 rounded-md"
                            />
                          </FormControl>
                          <FormLabel className="font-bold uppercase text-xs cursor-pointer">
                            Subject to EWT
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent
                  value="bank"
                  className="m-0 animate-in fade-in slide-in-from-bottom-2"
                >
                  <BankAccountManager
                    accounts={watchedBankAccounts || []}
                    banks={bankNames}
                    onAccountsChange={(accounts) =>
                      form.setValue("bank_accounts", accounts, {
                        shouldDirty: true,
                      })
                    }
                    isLoading={isLoadingBankNames}
                  />
                </TabsContent>
              </div>
            </Tabs>

            <div className="p-4 md:p-6 border-t border-border/50 bg-card/95 backdrop-blur-md shrink-0 flex items-center justify-end gap-3 z-20 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-12 px-6 font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="h-12 px-8 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all active:scale-95 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {customer ? "Save Changes" : "Create Customer"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
