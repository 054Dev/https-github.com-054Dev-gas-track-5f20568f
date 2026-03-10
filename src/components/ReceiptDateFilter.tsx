import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export type DateFilterType = "all" | "today" | "this_week" | "last_week" | "month" | "custom";

interface DateRange {
  start: Date;
  end: Date;
}

interface ReceiptDateFilterProps {
  onFilterChange: (range: DateRange | null, filterType: DateFilterType) => void;
}

interface MonthOption {
  label: string;
  year: number;
  month: number; // 0-indexed
}

export function ReceiptDateFilter({ onFilterChange }: ReceiptDateFilterProps) {
  const [filterType, setFilterType] = useState<DateFilterType>("today");
  const [customDate, setCustomDate] = useState<string>("");
  const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [showMultiYear, setShowMultiYear] = useState(false);

  useEffect(() => {
    loadAvailableDates();
  }, []);

  const loadAvailableDates = async () => {
    // Get the earliest payment date to determine available months/years
    const { data: earliest } = await supabase
      .from("payments")
      .select("paid_at")
      .order("paid_at", { ascending: true })
      .limit(1)
      .single();

    if (!earliest?.paid_at) return;

    const startDate = new Date(earliest.paid_at);
    const now = new Date();

    // Build list of months from earliest to now
    const months: MonthOption[] = [];
    const years = new Set<number>();

    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= now) {
      years.add(cursor.getFullYear());
      months.push({
        label: format(cursor, "MMMM yyyy"),
        year: cursor.getFullYear(),
        month: cursor.getMonth(),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    setAvailableMonths(months.reverse()); // Most recent first
    const yearArray = Array.from(years).sort((a, b) => b - a);
    setAvailableYears(yearArray);
    setShowMultiYear(yearArray.length > 1);
  };

  const handleFilterTypeChange = (type: DateFilterType) => {
    setFilterType(type);
    setSelectedMonth("");
    setSelectedYear("");

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
      case "month": {
        // Wait for month selection
        break;
      }
      case "custom": {
        // Wait for custom date input
        break;
      }
    }
  };

  const handleMonthSelect = (value: string) => {
    setSelectedMonth(value);
    const [yearStr, monthStr] = value.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const start = new Date(year, month, 1);
    const end = endOfMonth(start);
    end.setHours(23, 59, 59, 999);
    onFilterChange({ start, end }, "month");
  };

  const handleYearSelect = (value: string) => {
    setSelectedYear(value);
    setFilterType("all"); // Use "all" type but with year range
    const year = parseInt(value);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    end.setHours(23, 59, 59, 999);
    onFilterChange({ start, end }, "all");
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
          <SelectItem value="month">Month</SelectItem>
          <SelectItem value="custom">Custom Date</SelectItem>
        </SelectContent>
      </Select>

      {filterType === "month" && (
        <Select value={selectedMonth} onValueChange={handleMonthSelect}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Pick a month" />
          </SelectTrigger>
          <SelectContent className="bg-card z-50 max-h-[300px]">
            {availableMonths.map((m) => (
              <SelectItem key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showMultiYear && (
        <Select value={selectedYear} onValueChange={handleYearSelect}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent className="bg-card z-50">
            {availableYears.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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
