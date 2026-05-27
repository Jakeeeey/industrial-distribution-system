"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  className?: string;
}

export function DateRangePicker({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  className
}: DateRangePickerProps) {
  // Directly derive date range from props to avoid redundant state synchronization
  const date: DateRange | undefined = startDate || endDate ? {
    from: startDate ? new Date(startDate) : undefined,
    to: endDate ? new Date(endDate) : undefined,
  } : undefined;

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      setStartDate(format(range.from, "yyyy-MM-dd"));
    } else {
      setStartDate("");
    }
    
    if (range?.to) {
      setEndDate(format(range.to, "yyyy-MM-dd"));
    } else {
      setEndDate("");
    }
  };

  const displayText = () => {
    if (date?.from && date?.to) {
      return `${format(date.from, "MMM d, yyyy")} 00:00 - ${format(date.to, "MMM d, yyyy")} 23:59`;
    }
    if (date?.from) {
      return `${format(date.from, "MMM d, yyyy")} 00:00`;
    }
    return "Select date range";
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-[300px] justify-start text-left font-normal h-10 border border-input shadow-xs bg-background hover:bg-muted/30 transition-colors relative pr-10",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground/80" />
            <span className="text-xs font-semibold text-foreground/90">
              {displayText()}
            </span>
            {date && (
              <span
                role="button"
                aria-label="Clear date range"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleSelect(undefined);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground/60 hover:text-muted-foreground transition-colors z-10"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
