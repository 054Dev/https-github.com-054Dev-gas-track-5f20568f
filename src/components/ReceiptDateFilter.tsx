import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from "date-fns";

export type DateFilterType = "all" | "today" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";

interface DateRange {
  start: Date;
  end: Date;
}

interface ReceiptDateFilterProps {
  onFilterChange: (range: DateRange | null, filterType: DateFilterType) => void;
}

export function ReceiptDateFilter({ onFilterChange }: ReceiptDateFilterProps) {
  const [filterType, setFilterType] = useState<DateFilterType>("today");
  const [customDate, setCustomDate] = useState<string>("");

  const handleFilterTypeChange = (type: DateFilterType) => {
    setFilterType(type);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (type) {
      case "all": {
        onFilterChange(null, type);
        break;
      }
      case "today": {
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);
        onFilterChange({ start: today, end }, type);
        break;
      }
      case "this_week": {
        const start = startOfWeek(today, { weekStartsOn: 1 });
        const end = endOfWeek(today, { weekStartsOn: 1 });
        end.setHours(23, 59, 59, 999);
        onFilterChange({ start, end }, type);
        break;
      }
      case "last_week": {
        const lastWeek = subWeeks(today, 1);
        const start = startOfWeek(lastWeek, { weekStartsOn: 1 });
        const end = endOfWeek(lastWeek, { weekStartsOn: 1 });
        end.setHours(23, 59, 59, 999);
        onFilterChange({ start, end }, type);
        break;
      }
      case "this_month": {
        const start = startOfMonth(today);
        const end = endOfMonth(today);
        end.setHours(23, 59, 59, 999);
        onFilterChange({ start, end }, type);
        break;
      }
      case "last_month": {
        const lastMonth = subMonths(today, 1);
        const start = startOfMonth(lastMonth);
        const end = endOfMonth(lastMonth);
        end.setHours(23, 59, 59, 999);
        onFilterChange({ start, end }, type);
        break;
      }
      case "custom": {
        // Wait for custom date input
        break;
      }
    }
  };

  const handleCustomDateChange = (value: string) => {
    setCustomDate(value);
    if (value) {
      const date = new Date(value);
      date.setHours(0, 0, 0, 0);
      const end = new Date(value);
      end.setHours(23, 59, 59, 999);
      onFilterChange({ start: date, end }, "custom");
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Select value={filterType} onValueChange={(v) => handleFilterTypeChange(v as DateFilterType)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent className="bg-card z-50">
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="this_week">This Week</SelectItem>
          <SelectItem value="last_week">Last Week</SelectItem>
          <SelectItem value="this_month">This Month</SelectItem>
          <SelectItem value="last_month">Last Month</SelectItem>
          <SelectItem value="custom">Custom Date</SelectItem>
        </SelectContent>
      </Select>

      {filterType === "custom" && (
        <Input
          type="date"
          value={customDate}
          onChange={(e) => handleCustomDateChange(e.target.value)}
          className="w-[160px]"
        />
      )}
    </div>
  );
}
