'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

export interface ProductOption {
    product_id: number;
    product_name: string;
    product_code: string;
    brand_name?: string;
    product_brand?: number | { brand_id?: number; brand_name?: string } | null;
    brand_id?: number | { brand_name?: string; name?: string } | null;
}

// AG-COMMENT: Helper to extract or resolve brand name for cylinder asset products from vos_database.products
export function resolveBrandName(opt: ProductOption): string {
    if (opt.brand_name?.trim()) return opt.brand_name.trim();

    // Check product_brand relation from vos_database.products
    if (typeof opt.product_brand === 'object' && opt.product_brand !== null) {
        if (opt.product_brand.brand_name?.trim()) return opt.product_brand.brand_name.trim();
    }

    // Check brand_id relation fallback
    if (typeof opt.brand_id === 'object' && opt.brand_id !== null) {
        if (opt.brand_id.brand_name?.trim()) return opt.brand_id.brand_name.trim();
        if (opt.brand_id.name?.trim()) return opt.brand_id.name.trim();
    }

    const parts = opt.product_name.split(/[-_]/);
    if (parts.length > 1) {
        const potentialBrand = parts[1].replace(/\(.*\)/, '').trim();
        if (potentialBrand) return potentialBrand;
    }
    return '';
}

interface ProductSearchSelectProps {
    options: ProductOption[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function ProductSearchSelect({
    options,
    value,
    onValueChange,
    placeholder = "Select Product...",
    disabled = false,
}: ProductSearchSelectProps) {
    const [open, setOpen] = React.useState(false);

    const selectedProduct = React.useMemo(() => {
        return options.find((opt) => String(opt.product_id) === value);
    }, [options, value]);

    const selectedBrand = React.useMemo(() => {
        return selectedProduct ? resolveBrandName(selectedProduct) : '';
    }, [selectedProduct]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between h-9 bg-background border-border rounded-lg text-xs font-bold text-left",
                        !value && "text-muted-foreground font-normal"
                    )}
                    disabled={disabled}
                >
                    <span className="truncate flex items-center gap-1.5">
                        {selectedProduct ? (
                            <>
                                <span className="font-semibold">{selectedProduct.product_name}</span>
                                {selectedBrand ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase shrink-0">
                                        {selectedBrand}
                                    </span>
                                ) : null}
                                <span className="text-[10px] text-muted-foreground font-mono shrink-0">({selectedProduct.product_code})</span>
                            </>
                        ) : (
                            placeholder
                        )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search product..." className="text-xs h-9" />
                    <CommandList className="max-h-[220px]">
                        <CommandEmpty className="text-xs p-3 text-muted-foreground">No products found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => {
                                const key = String(opt.product_id);
                                const brandName = resolveBrandName(opt);
                                const label = `${opt.product_name} ${brandName} ${opt.product_code}`;
                                return (
                                    <CommandItem
                                        key={key}
                                        value={label}
                                        onSelect={() => {
                                            onValueChange(key);
                                            setOpen(false);
                                        }}
                                        className="text-xs rounded-md mb-0.5 cursor-pointer flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            <Check
                                                className={cn(
                                                    "h-4 w-4 text-primary shrink-0",
                                                    value === key ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <span className="font-medium truncate">{opt.product_name}</span>
                                            {brandName && (
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase shrink-0">
                                                    {brandName}
                                                </span>
                                            )}
                                        </div>
                                        <span className="ml-2 text-[10px] text-muted-foreground font-mono shrink-0">({opt.product_code})</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
