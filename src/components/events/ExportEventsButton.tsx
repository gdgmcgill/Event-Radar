"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EventTag } from "@/types";

interface ExportEventsButtonProps {
    searchQuery?: string;
    selectedTags?: EventTag[];
    dateFrom?: string;
    dateTo?: string;
    clubId?: string;
}

export function ExportEventsButton({
    searchQuery,
    selectedTags,
    dateFrom,
    dateTo,
    clubId,
}: ExportEventsButtonProps) {
    const [isExportingCsv, setIsExportingCsv] = useState(false);
    const [isExportingIcal, setIsExportingIcal] = useState(false);

    const handleExport = async (format: "csv" | "ical") => {
        try {
            if (format === "csv") setIsExportingCsv(true);
            if (format === "ical") setIsExportingIcal(true);

            const params = new URLSearchParams();
            params.append("format", format);

            if (searchQuery) params.append("search", searchQuery);
            if (selectedTags && selectedTags.length > 0) {
                params.append("tags", selectedTags.join(","));
            }
            if (dateFrom) params.append("dateFrom", dateFrom);
            if (dateTo) params.append("dateTo", dateTo);
            if (clubId) params.append("clubId", clubId);

            const response = await fetch(`/api/events/export?${params.toString()}`);
            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `events.${format === "ical" ? "ics" : format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Failed to export events:", error);
            // In a real app, you might want to show a toast notification here
        } finally {
            if (format === "csv") setIsExportingCsv(false);
            if (format === "ical") setIsExportingIcal(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-xl border-border/60 bg-card/50 backdrop-blur-sm hover:bg-card hover:text-primary transition-all shadow-sm">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuItem
                    onClick={() => handleExport("csv")}
                    disabled={isExportingCsv || isExportingIcal}
                    className="gap-2 focus:bg-primary/10 cursor-pointer"
                >
                    {isExportingCsv ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <FileSpreadsheet className="h-4 w-4" />
                    )}
                    Export as CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() => handleExport("ical")}
                    disabled={isExportingCsv || isExportingIcal}
                    className="gap-2 focus:bg-primary/10 cursor-pointer"
                >
                    {isExportingIcal ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <CalendarIcon className="h-4 w-4" />
                    )}
                    Export as iCal
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
