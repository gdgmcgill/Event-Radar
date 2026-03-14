"use client";

import { forwardRef, useEffect, useState } from "react";
import { format } from "date-fns";
import DatePicker from "react-datepicker";
import { classifyTags } from "@/lib/classifier";
import { Button } from "@/components/ui/button";
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
  Calendar,
  Clock,
  MapPin,
  Camera,
  Lightbulb,
  ChevronRight,
  ImageIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { uploadEventImage } from "@/lib/upload-utils";
import { TimePicker } from "@/components/ui/time-picker";

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
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  tags: EventTag[];
  imageFile: File | null;
}

interface FormErrors {
  title?: string;
  description?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  location?: string;
  tags?: string;
}

interface CreateEventFormProps {
  clubId?: string;
  onSuccess?: () => void;
  initialData?: {
    title: string;
    description: string;
    start_date?: string;
    location: string;
    tags: EventTag[];
    image_url?: string | null;
    category?: string | null;
  };
  eventId?: string;
  mode?: "create" | "edit" | "duplicate";
}

interface DatePickerTriggerProps {
  value?: string;
  onClick?: () => void;
  placeholder: string;
  hasError?: boolean;
}

const DatePickerTrigger = forwardRef<HTMLButtonElement, DatePickerTriggerProps>(
  ({ value, onClick, placeholder, hasError }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[1.5rem] w-full items-center gap-2 rounded-md px-1 py-0 text-left text-sm font-medium leading-none text-slate-800 dark:text-slate-100 hover:text-primary transition-colors outline-none cursor-pointer whitespace-nowrap",
        !value && "text-slate-400",
        hasError && "text-destructive"
      )}
    >
      <Calendar className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{value || placeholder}</span>
    </button>
  )
);
DatePickerTrigger.displayName = "DatePickerTrigger";

function getTodayAtMidnight() {
  return new Date(new Date().setHours(0, 0, 0, 0));
}

export function CreateEventForm({
  clubId,
  onSuccess,
  initialData,
  eventId,
  mode = "create",
}: CreateEventFormProps) {
  // Parse initial date/time for edit mode
  const getInitialDateParts = () => {
    if (initialData?.start_date && mode === "edit") {
      const dt = new Date(initialData.start_date);
      const date = dt.toISOString().split("T")[0];
      const time = dt.toTimeString().slice(0, 5);
      return { date, time };
    }
    return { date: "", time: "" };
  };

  const initialDateParts = getInitialDateParts();

  const [formData, setFormData] = useState<FormData>({
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    startDate: initialDateParts.date,
    startTime: initialDateParts.time,
    endDate: initialDateParts.date,
    endTime: "",
    location: initialData?.location ?? "",
    tags: initialData?.tags ?? [],
    imageFile: null,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialData?.image_url ?? null
  );
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
    if (!formData.startDate) newErrors.startDate = "Start date is required";
    if (!formData.startTime) newErrors.startTime = "Start time is required";
    if (!formData.endDate) newErrors.endDate = "End date is required";
    if (!formData.endTime) newErrors.endTime = "End time is required";
    if (!formData.location.trim()) newErrors.location = "Location is required";
    if (formData.tags.length === 0) newErrors.tags = "Select at least one category";

    // Check start datetime is in the future
    if (formData.startDate && formData.startTime) {
      const startDT = new Date(`${formData.startDate}T${formData.startTime}`);
      if (startDT < new Date()) {
        newErrors.startDate = "Event must be in the future";
      }
    }

    // Check end datetime is after start datetime
    if (formData.startDate && formData.startTime && formData.endDate && formData.endTime) {
      const startDT = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDT = new Date(`${formData.endDate}T${formData.endTime}`);
      if (endDT <= startDT) {
        newErrors.endDate = "End must be after start";
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

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError("Image must be less than 5MB");
      return;
    }
    handleImageChange(file);
    setSubmitError(null);
  };

  const handleDiscard = () => {
    setFormData({
      title: "",
      description: "",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      location: "",
      tags: [],
      imageFile: null,
    });
    removeImage();
    setErrors({});
    setSubmitError(null);
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

      // Build the start_date and end_date as ISO strings
      const startDate = new Date(`${formData.startDate}T${formData.startTime}`).toISOString();
      const endDate = new Date(`${formData.endDate}T${formData.endTime}`).toISOString();

      // Determine the image URL to send
      const finalImageUrl = imageUrl ?? (formData.imageFile ? null : imagePreview);

      let res: Response;

      if (mode === "edit" && eventId) {
        // PATCH only changed fields
        const updates: Record<string, unknown> = {};
        if (formData.title !== initialData?.title) updates.title = formData.title;
        if (formData.description !== initialData?.description) updates.description = formData.description;
        if (formData.location !== initialData?.location) updates.location = formData.location;
        if (JSON.stringify(formData.tags) !== JSON.stringify(initialData?.tags)) updates.tags = formData.tags;
        updates.start_date = startDate;
        updates.end_date = endDate;
        updates.category = formData.tags[0];
        if (finalImageUrl !== initialData?.image_url) updates.image_url = finalImageUrl;

        res = await fetch(`/api/events/${eventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      } else {
        // POST for create and duplicate modes
        res = await fetch("/api/events/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            start_date: startDate,
            end_date: endDate,
            location: formData.location,
            tags: formData.tags,
            image_url: finalImageUrl,
            category: formData.tags[0],
            club_id: clubId,
          }),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || (mode === "edit" ? "Failed to update event" : "Failed to create event"));
      }

      setSuccessMessage(
        mode === "edit" ? "Event updated!" : (data.message || "Event submitted!")
      );
      setSuccess(true);
      // Reset form
      setFormData({
        title: "",
        description: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
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

  // Format the preview date/time
  const formatPreviewDateTime = () => {
    if (!formData.startDate && !formData.startTime) return null;
    const parts: string[] = [];
    if (formData.startDate) {
      try {
        const d = new Date(formData.startDate + "T00:00:00");
        parts.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase());
      } catch {
        parts.push(formData.startDate);
      }
    }
    if (formData.startTime) {
      try {
        const [h, m] = formData.startTime.split(":");
        const d = new Date();
        d.setHours(parseInt(h), parseInt(m));
        parts.push(d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
      } catch {
        parts.push(formData.startTime);
      }
    }
    return parts.join(" \u2022 ");
  };

  if (success) {
    const isEdit = mode === "edit";
    const isApproved = successMessage.toLowerCase().includes("approved");
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 bg-card rounded-2xl border border-green-200 dark:border-green-900/50 p-8">
        <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">
          {isEdit ? "Event Updated!" : isApproved ? "Event Published!" : "Event Submitted!"}
        </h3>
        <p className="text-muted-foreground max-w-md">
          {isEdit
            ? "Your changes have been saved."
            : isApproved
              ? "Your event has been approved and is now live on the platform."
              : "Your event has been submitted for review. An admin will approve it shortly."}
        </p>
        {!isEdit && (
          <Button onClick={() => setSuccess(false)} className="mt-4 cursor-pointer">
            Create Another Event
          </Button>
        )}
      </div>
    );
  }

  const selectedCategory = formData.tags.length > 0 ? formData.tags[0] : null;
  const selectedCategoryLabel = selectedCategory ? EVENT_CATEGORIES[selectedCategory].label : null;

  return (
    <div className="flex flex-col lg:flex-row gap-10">
      {/* Form Section */}
      <div className="flex-1 space-y-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Submit Error */}
          {submitError && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {submitError}
            </div>
          )}

          {/* Category Selection */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Category</h3>

            {suggestedTags.length > 0 && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                      "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200",
                      isSelected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-primary/50"
                    )}
                  >
                    <Icon className="h-7 w-7 mb-2" />
                    <span className="text-xs font-bold uppercase tracking-wider">{cat.label}</span>
                  </button>
                );
              })}
            </div>
            {errors.tags && <p className="text-xs text-destructive">{errors.tags}</p>}
          </section>

          {/* Event Title */}
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Event Title
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, title: e.target.value }));
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="e.g. Annual Tech Symposium 2024"
              className={cn(
                "w-full px-4 py-3 rounded-lg border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-primary focus:ring-0 outline-none transition-all text-sm",
                errors.title && "border-destructive"
              )}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, description: e.target.value }));
                if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
              }}
              placeholder="Describe your event - what will attendees experience?"
              rows={3}
              className={cn(
                "w-full px-4 py-3 rounded-lg border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-primary focus:ring-0 outline-none transition-all text-sm resize-y",
                errors.description && "border-destructive"
              )}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          {/* Date & Time */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Date &amp; Time</h3>

            {/*
              Single 2×2 grid so columns are shared across both rows —
              this guarantees the vertical divider stays perfectly aligned.
            */}
            <div className="rounded-xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 grid grid-cols-2 divide-x divide-y divide-slate-200 dark:divide-slate-800">

              {/* ── Start date ── */}
              <div className="p-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Start</p>
                <DatePicker
                  selected={formData.startDate ? new Date(formData.startDate + "T00:00:00") : null}
                  onChange={(day: Date | null) => {
                    const val = day ? format(day, "yyyy-MM-dd") : "";
                    setFormData((prev) => ({
                      ...prev,
                      startDate: val,
                      endDate: prev.endDate && prev.endDate < val ? val : prev.endDate,
                    }));
                    if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: undefined }));
                  }}
                  minDate={getTodayAtMidnight()}
                  dateFormat="MMM d, yyyy"
                  popperPlacement="bottom-start"
                  showPopperArrow={false}
                  wrapperClassName="block w-full"
                  customInput={<DatePickerTrigger placeholder="(set date)" hasError={!!errors.startDate} />}
                />
                {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
              </div>

              {/* ── Start time ── */}
              <div className="p-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Time</p>
                <TimePicker
                  value={formData.startTime}
                  onChange={(val) => {
                    setFormData((prev) => ({ ...prev, startTime: val }));
                    if (errors.startTime) setErrors((prev) => ({ ...prev, startTime: undefined }));
                  }}
                  placeholder="Set time"
                  hasError={!!errors.startTime}
                />
                {errors.startTime && <p className="text-xs text-destructive">{errors.startTime}</p>}
              </div>

              {/* ── End date ── */}
              <div className="p-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">End</p>
                <DatePicker
                  selected={formData.endDate ? new Date(formData.endDate + "T00:00:00") : null}
                  onChange={(day: Date | null) => {
                    const val = day ? format(day, "yyyy-MM-dd") : "";
                    setFormData((prev) => ({ ...prev, endDate: val }));
                    if (errors.endDate) setErrors((prev) => ({ ...prev, endDate: undefined }));
                  }}
                  minDate={formData.startDate ? new Date(formData.startDate + "T00:00:00") : getTodayAtMidnight()}
                  dateFormat="MMM d, yyyy"
                  popperPlacement="bottom-start"
                  showPopperArrow={false}
                  wrapperClassName="block w-full"
                  customInput={<DatePickerTrigger placeholder="(set date)" hasError={!!errors.endDate} />}
                />
                {errors.endDate && <p className="text-xs text-destructive">{errors.endDate}</p>}
              </div>

              {/* ── End time ── */}
              <div className="p-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Time</p>
                <TimePicker
                  value={formData.endTime}
                  onChange={(val) => {
                    setFormData((prev) => ({ ...prev, endTime: val }));
                    if (errors.endTime) setErrors((prev) => ({ ...prev, endTime: undefined }));
                  }}
                  placeholder="Set time"
                  hasError={!!errors.endTime}
                />
                {errors.endTime && <p className="text-xs text-destructive">{errors.endTime}</p>}
              </div>

            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label htmlFor="location" className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                id="location"
                type="text"
                value={formData.location}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, location: e.target.value }));
                  if (errors.location) setErrors((prev) => ({ ...prev, location: undefined }));
                }}
                placeholder="University Hall, Room 302"
                className={cn(
                  "w-full pl-10 pr-4 py-3 rounded-lg border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-primary focus:ring-0 outline-none transition-all text-sm",
                  errors.location && "border-destructive"
                )}
              />
            </div>
            {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Cover Image
            </label>
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 h-48 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Event image preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur flex items-center justify-center text-slate-600 hover:text-destructive transition-colors shadow-md"
                >
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Camera className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Click to upload or drag and drop</p>
                <p className="text-xs text-slate-500 mt-1">Recommended size: 1200x600px (Max 5MB)</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={handleDiscard}
              className="px-6 py-3 rounded-lg font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              Discard Draft
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 rounded-lg font-bold bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === "edit" ? "Saving..." : "Publishing..."}
                </>
              ) : mode === "edit" ? (
                "Save Changes"
              ) : (
                "Publish Event"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Preview Sidebar */}
      <aside className="lg:w-96 space-y-6">
        <div className="sticky top-24">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Live Preview</h3>
            <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
              Card View
            </span>
          </div>

          {/* Preview Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="relative h-48 bg-slate-200 dark:bg-slate-800">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-slate-400" />
                </div>
              )}
              {selectedCategoryLabel && (
                <div className="absolute top-3 right-3 px-3 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-full text-[10px] font-black uppercase tracking-widest text-primary">
                  {selectedCategoryLabel}
                </div>
              )}
            </div>
            <div className="p-6">
              {formatPreviewDateTime() && (
                <div className="flex items-center gap-2 text-primary font-bold text-xs mb-2">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatPreviewDateTime()}</span>
                </div>
              )}
              <h4 className="text-xl font-black text-slate-900 dark:text-white leading-tight mb-2">
                {formData.title || "Event Title"}
              </h4>
              {formData.location && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-4">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{formData.location}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex -space-x-2">
                  <div className="h-8 w-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-300" />
                  <div className="h-8 w-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-300" />
                  <div className="h-8 w-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-300" />
                  <div className="h-8 w-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    +42
                  </div>
                </div>
                <span className="text-xs font-bold text-primary">View Details</span>
              </div>
            </div>
          </div>

          {/* Success Tips */}
          <div className="mt-8 p-6 bg-primary/5 rounded-2xl border border-primary/10">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3">
              <Lightbulb className="h-5 w-5 text-primary" />
              Success Tips
            </h4>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-3 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-primary">&#8226;</span>
                <span>High-quality images get 3x more engagement from the community.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">&#8226;</span>
                <span>Clearly specify the location to help students find your venue easily.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">&#8226;</span>
                <span>Choose the right category to appear in relevant search filters.</span>
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
