"use client";

import { useState, useEffect } from "react";
import { classifyTags } from "@/lib/classifier";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVENT_TAGS, EVENT_CATEGORIES } from "@/lib/constants";
import type { Event, EventTag } from "@/types";
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
import { EventImageUpload } from "@/components/events/EventImageUpload";

const iconMap: Record<string, LucideIcon> = {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
};

interface EditEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event | null;
  onSuccess?: () => void;
}

export function EditEventModal({
  open,
  onOpenChange,
  event,
  onSuccess,
}: EditEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState<EventTag[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedTags, setSuggestedTags] = useState<EventTag[]>([]);

  useEffect(() => {
    const textToClassify = `${title} ${description}`.trim();
    if (textToClassify.length < 10) {
      setSuggestedTags([]);
      return;
    }

    const timer = setTimeout(() => {
      const suggestions = classifyTags(textToClassify) as EventTag[];
      // Filter out tags that are already selected
      const newSuggestions = suggestions.filter((tag) => !tags.includes(tag));
      setSuggestedTags(newSuggestions);
    }, 500);

    return () => clearTimeout(timer);
  }, [title, description, tags]);

  // Sync form state when event changes
  const resetForm = (ev: Event) => {
    setTitle(ev.title);
    setDescription(ev.description);
    setDate(ev.event_date);
    setTime(ev.event_time);
    setLocation(ev.location);
    setTags([...ev.tags]);
    setImageFile(null);
    setImagePreview(ev.image_url || null);
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && event) {
      resetForm(event);
    }
    onOpenChange(nextOpen);
  };

  const toggleTag = (tag: EventTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleImageChange = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    setSubmitting(true);
    setError(null);

    try {
      let finalImageUrl = imagePreview;

      // Upload new image if provided
      if (imageFile) {
        const uploadedUrl = await uploadEventImage(imageFile);
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        }
      }

      const startDate = new Date(`${date}T${time}`).toISOString();

      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          start_date: startDate,
          end_date: startDate,
          location,
          tags,
          image_url: finalImageUrl,
          category: tags[0],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update event");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
          <DialogDescription>
            Update the details of this event.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="edit-title" className="text-sm font-semibold text-foreground">
              Title
            </label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-description" className="text-sm font-semibold text-foreground">
              Description
            </label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="edit-date" className="text-sm font-semibold text-foreground">
                Date
              </label>
              <Input
                id="edit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-time" className="text-sm font-semibold text-foreground">
                Time
              </label>
              <Input
                id="edit-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-location" className="text-sm font-semibold text-foreground">
              Location
            </label>
            <Input
              id="edit-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">Categories</label>

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

            <div className="flex flex-wrap gap-2">
              {EVENT_TAGS.map((tag) => {
                const cat = EVENT_CATEGORIES[tag];
                const Icon = iconMap[cat.icon] || Heart;
                const isSelected = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all duration-200 text-sm font-medium",
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
          </div>

          <EventImageUpload
            imagePreview={imagePreview}
            onImageChange={handleImageChange}
            onImageRemove={removeImage}
            setError={setError}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
