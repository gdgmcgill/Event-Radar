"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

interface EventImageUploadProps {
    imagePreview: string | null;
    onImageChange: (file: File) => void;
    onImageRemove: () => void;
    setError?: (error: string | null) => void;
    className?: string;
    maxSizeMB?: number;
}

export function EventImageUpload({
    imagePreview,
    onImageChange,
    onImageRemove,
    setError,
    className = "",
    maxSizeMB = 5,
}: EventImageUploadProps) {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size
        if (file.size > maxSizeMB * 1024 * 1024) {
            setError?.(`Image must be less than ${maxSizeMB}MB`);
            return;
        }

        onImageChange(file);
        setError?.(null);
    };

    return (
        <div className={`space-y-2 ${className}`}>
            <label className="text-sm font-semibold text-foreground">
                Event Image <span className="text-muted-foreground font-normal">(optional)</span>
            </label>

            {imagePreview ? (
                <div className="group relative w-full max-w-sm rounded-2xl overflow-hidden shadow-md bg-card border border-border/40 h-52">
                    {/* eslint-disable-next-line @next/next/no-img-element -- handles both local blobs and remote URLs */}
                    <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />

                    {/* Gradient Overlay matching EventCard */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 dark:from-white/6 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* X button matching styling and positioning of the Heart save button */}
                    <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={onImageRemove}
                        className="absolute top-3 right-3 h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border/40 bg-card/90 text-muted-foreground hover:text-destructive hover:bg-card transition-all duration-300 hover:scale-110"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            ) : (
                <label className="flex flex-col items-center justify-center h-40 max-w-sm rounded-xl border-2 border-dashed border-border/60 bg-card/30 cursor-pointer hover:border-border hover:bg-muted/30 transition-colors">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click to upload</span>
                    <span className="text-xs text-muted-foreground/60 mt-1">Max {maxSizeMB}MB</span>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                </label>
            )}
        </div>
    );
}
