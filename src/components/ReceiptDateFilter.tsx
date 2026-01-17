import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, format } from "date-fns";

export type DateFilterType = "today" | "this_week" | "last_week" | "month" | "custom";

interface DateRange {
  start: Date;
  end: Date;
}

interface ReceiptDateFilterProps {
  onFilterChange: (range: DateRange | null, filterType: DateFilterType) => void;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function ReceiptDateFilter({ onFilterChange }: ReceiptDateFilterProps) {
  const [filterType, setFilterType] = useState<DateFilterType>("today");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [customDate, setCustomDate] = useState<string>("");
  const [isMonthOpen, setIsMonthOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleFilterTypeChange = (type: DateFilterType) => {
    setFilterType(type);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (type) {
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
        setIsMonthOpen(true);
        break;
      }
      case "custom": {
        // Wait for custom date input
        break;
      }
    }
  };

  const handleMonthSelect = () => {
    const start = startOfMonth(new Date(selectedYear, selectedMonth));
    const end = endOfMonth(new Date(selectedYear, selectedMonth));
    end.setHours(23, 59, 59, 999);
    onFilterChange({ start, end }, "month");
    setIsMonthOpen(false);
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

  const getFilterLabel = () => {
    switch (filterType) {
      case "today":
        return "Today";
      case "this_week":
        return "This Week";
      case "last_week":
        return "Last Week";
      case "month":
        return `${MONTHS[selectedMonth]} ${selectedYear}`;
      case "custom":
        return customDate ? format(new Date(customDate), "MMM dd, yyyy") : "Select Date";
      default:
        return "Select Period";
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Select value={filterType} onValueChange={(v) => handleFilterTypeChange(v as DateFilterType)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent className="bg-card z-50">
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="this_week">This Week</SelectItem>
          <SelectItem value="last_week">Last Week</SelectItem>
          <SelectItem value="month">Month</SelectItem>
          <SelectItem value="custom">Custom Date</SelectItem>
        </SelectContent>
      </Select>

      {filterType === "month" && (
        <Popover open={isMonthOpen} onOpenChange={setIsMonthOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              {MONTHS[selectedMonth]} {selectedYear}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4 bg-card z-50" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select 
                  value={selectedMonth.toString()} 
                  onValueChange={(v) => setSelectedMonth(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card z-50">
                    {MONTHS.map((month, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select 
                  value={selectedYear.toString()} 
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card z-50">
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleMonthSelect} className="w-full">
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
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
