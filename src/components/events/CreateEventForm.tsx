"use client";

import { useState, useEffect } from "react";
import { classifyTags } from "@/lib/classifier";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVENT_TAGS, EVENT_CATEGORIES } from "@/lib/constants";
import type { EventTag } from "@/types";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  Loader2,
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { uploadEventImage } from "@/lib/upload-utils";
import { EventImageUpload } from "./EventImageUpload";

const iconMap: Record<string, LucideIcon> = {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
};

interface FormData {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  tags: EventTag[];
  imageFile: File | null;
}

interface FormErrors {
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  tags?: string;
}

interface CreateEventFormProps {
  clubId?: string;
  onSuccess?: () => void;
}

export function CreateEventForm({ clubId, onSuccess }: CreateEventFormProps) {
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    tags: [],
    imageFile: null,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [suggestedTags, setSuggestedTags] = useState<EventTag[]>([]);

  useEffect(() => {
    const textToClassify = `${formData.title} ${formData.description}`.trim();
    if (textToClassify.length < 10) {
      setSuggestedTags([]);
      return;
    }

    const timer = setTimeout(() => {
      const suggestions = classifyTags(textToClassify) as EventTag[];
      // Filter out tags that are already selected
      const newSuggestions = suggestions.filter((tag) => !formData.tags.includes(tag));
      setSuggestedTags(newSuggestions);
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.title, formData.description, formData.tags]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) newErrors.title = "Title is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.time) newErrors.time = "Time is required";
    if (!formData.location.trim()) newErrors.location = "Location is required";
    if (formData.tags.length === 0) newErrors.tags = "Select at least one category";

    // Check date is in the future
    if (formData.date && formData.time) {
      const eventDate = new Date(`${formData.date}T${formData.time}`);
      if (eventDate < new Date()) {
        newErrors.date = "Event must be in the future";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleTag = (tag: EventTag) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
    if (errors.tags) setErrors((prev) => ({ ...prev, tags: undefined }));
  };

  const handleImageChange = (file: File) => {
    setFormData((prev) => ({ ...prev, imageFile: file }));
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, imageFile: null }));
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Upload image if provided
      let imageUrl: string | null = null;
      if (formData.imageFile) {
        imageUrl = await uploadEventImage(formData.imageFile);
        if (!imageUrl) {
          // Image upload failed but continue without image
          console.warn("Image upload failed, submitting without image");
        }
      }

      // Build the start_date as ISO string
      const startDate = new Date(`${formData.date}T${formData.time}`).toISOString();

      const res = await fetch("/api/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          start_date: startDate,
          end_date: startDate,
          location: formData.location,
          tags: formData.tags,
          image_url: imageUrl,
          category: formData.tags[0],
          club_id: clubId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create event");
      }

      setSuccess(true);
      // Reset form
      setFormData({
        title: "",
        description: "",
        date: "",
        time: "",
        location: "",
        tags: [],
        imageFile: null,
      });
      removeImage();
      onSuccess?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 bg-card rounded-2xl border border-green-200 dark:border-green-900/50 p-8">
        <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">Event Submitted!</h3>
        <p className="text-muted-foreground max-w-md">
          Your event has been submitted for review. An admin will approve it shortly and it will appear on the platform.
        </p>
        <Button onClick={() => setSuccess(false)} className="mt-4">
          Submit Another Event
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Submit Error */}
      {submitError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {submitError}
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <label htmlFor="title" className="text-sm font-semibold text-foreground">
          Event Title <span className="text-destructive">*</span>
        </label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, title: e.target.value }));
            if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
          }}
          placeholder="e.g., AI Workshop: Introduction to Machine Learning"
          className={cn("rounded-xl", errors.title && "border-destructive")}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-semibold text-foreground">
          Description <span className="text-destructive">*</span>
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, description: e.target.value }));
            if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
          }}
          placeholder="Describe your event - what will attendees experience?"
          rows={4}
          className={cn(
            "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y",
            errors.description && "border-destructive"
          )}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="date" className="text-sm font-semibold text-foreground">
            Date <span className="text-destructive">*</span>
          </label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, date: e.target.value }));
              if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
            }}
            className={cn("rounded-xl", errors.date && "border-destructive")}
          />
          {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
        </div>
        <div className="space-y-2">
          <label htmlFor="time" className="text-sm font-semibold text-foreground">
            Time <span className="text-destructive">*</span>
          </label>
          <Input
            id="time"
            type="time"
            value={formData.time}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, time: e.target.value }));
              if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
            }}
            className={cn("rounded-xl", errors.time && "border-destructive")}
          />
          {errors.time && <p className="text-xs text-destructive">{errors.time}</p>}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <label htmlFor="location" className="text-sm font-semibold text-foreground">
          Location <span className="text-destructive">*</span>
        </label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, location: e.target.value }));
            if (errors.location) setErrors((prev) => ({ ...prev, location: undefined }));
          }}
          placeholder="e.g., Trottier Building, Room 2120"
          className={cn("rounded-xl", errors.location && "border-destructive")}
        />
        {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
      </div>

      {/* Tags / Categories */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">
          Categories <span className="text-destructive">*</span>
        </label>
        <p className="text-xs text-muted-foreground">Select all that apply</p>

        {suggestedTags.length > 0 && (
          <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
            <p className="text-xs font-medium text-primary flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Suggested based on your details
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedTags.map((tag) => {
                const cat = EVENT_CATEGORIES[tag];
                const Icon = iconMap[cat.icon] || Heart;
                return (
                  <button
                    key={`suggested-${tag}`}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
                  >
                    <Icon className="h-3 w-3" />
                    {cat.label}
                    <span className="text-[10px] opacity-70 ml-1">+ Add</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {EVENT_TAGS.map((tag) => {
            const cat = EVENT_CATEGORIES[tag];
            const Icon = iconMap[cat.icon] || Heart;
            const isSelected = formData.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-200 text-sm font-medium",
                  isSelected
                    ? `${cat.borderColor} ${cat.selectedBg} ${cat.color}`
                    : "border-border/60 bg-card text-muted-foreground hover:border-border hover:bg-muted/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {cat.label}
                {isSelected && <CheckCircle className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
        {errors.tags && <p className="text-xs text-destructive">{errors.tags}</p>}
      </div>

      <EventImageUpload
        imagePreview={imagePreview}
        onImageChange={handleImageChange}
        onImageRemove={removeImage}
        setError={setSubmitError}
      />

      {/* Submit */}
      <Button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto px-8 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit Event for Review"
        )}
      </Button>
    </form>
  );
}
