"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

interface SearchableSelectProps {
	options: { value: string; label: string }[];
	value: string;
	onValueChange: (value: string) => void;
	placeholder: string;
	emptyText?: string;
	disabled?: boolean;
	className?: string;
}

export function SearchableSelect({
	options,
	value,
	onValueChange,
	placeholder,
	emptyText = "No results found.",
	disabled = false,
	className,
}: SearchableSelectProps) {
	const [open, setOpen] = React.useState(false);

	const selectedLabel = React.useMemo(() => {
		return options.find((opt) => opt.value === value)?.label;
	}, [options, value]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className={cn(
						"w-full justify-between h-9 text-sm font-normal border-input bg-background transition-all",
						!value && "text-muted-foreground",
						className
					)}
					disabled={disabled}
				>
					<span className="truncate">{selectedLabel || placeholder}</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[--radix-popover-trigger-width] p-0 border shadow-md rounded-md overflow-hidden bg-background"
				align="start"
				sideOffset={4}
			>
				<Command className="border-none" loop>
					<CommandInput
						placeholder={`Search ${placeholder.toLowerCase()}...`}
						className="border-none focus:ring-0 h-9 text-sm bg-transparent"
					/>
					<CommandList
						className="max-h-[300px] overflow-y-auto p-1"
						onWheel={(e) => e.stopPropagation()}
					>
						<CommandEmpty className="py-4 text-center text-xs font-medium text-muted-foreground">
							{emptyText}
						</CommandEmpty>
						<CommandGroup>
							{options.map((opt) => (
								<CommandItem
									key={opt.value}
									value={(opt.label + " " + opt.value).toLowerCase()}
									onSelect={() => {
										onValueChange(opt.value);
										setOpen(false);
									}}
									className="cursor-pointer"
								>
									<Check
										className={cn(
											"mr-2 h-4 w-4",
											value === opt.value ? "opacity-100" : "opacity-0"
										)}
									/>
									<span className="truncate">{opt.label}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
