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
                <div className="relative w-full max-w-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element -- handles both local blobs and remote URLs */}
                    <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-xl border border-border"
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={onImageRemove}
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-card/90 backdrop-blur-sm"
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
