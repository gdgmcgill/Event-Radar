"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
};

export interface EditablePendingEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location: string | null;
  organizer: string | null;
  tags: string[] | null;
  image_url: string | null;
  status: string;
  created_at: string | null;
}

interface FormData {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  organizer: string;
  tags: EventTag[];
  image_url: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  tags?: string;
}

interface AdminEventEditModalProps {
  event: EditablePendingEvent | null;
  onClose: () => void;
  onSaved: (updatedEvent: EditablePendingEvent) => void;
  onSavedAndApproved: (eventId: string) => void;
}

function toLocalDateTimeStrings(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  // Format as YYYY-MM-DD and HH:MM in local time
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

export function AdminEventEditModal({
  event,
  onClose,
  onSaved,
  onSavedAndApproved,
}: AdminEventEditModalProps) {
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    organizer: "",
    tags: [],
    image_url: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Populate form whenever a different event is opened
  useEffect(() => {
    if (!event) return;
    const { date, time } = toLocalDateTimeStrings(event.start_date);
    setFormData({
      title: event.title,
      description: event.description ?? "",
      date,
      time,
      location: event.location ?? "",
      organizer: event.organizer ?? "",
      tags: (event.tags ?? []) as EventTag[],
      image_url: event.image_url ?? "",
    });
    setErrors({});
    setSaveError(null);
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.title.trim()) newErrors.title = "Title is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.time) newErrors.time = "Time is required";
    if (!formData.location.trim()) newErrors.location = "Location is required";
    if (formData.tags.length === 0) newErrors.tags = "Select at least one category";
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

  const buildPayload = () => {
    const startDate = new Date(`${formData.date}T${formData.time}`).toISOString();
    return {
      title: formData.title.trim(),
      description: formData.description.trim(),
      start_date: startDate,
      end_date: startDate,
      location: formData.location.trim(),
      organizer: formData.organizer.trim() || null,
      tags: formData.tags,
      category: formData.tags[0] ?? null,
      image_url: formData.image_url.trim() || null,
    };
  };

  const saveEvent = async (): Promise<EditablePendingEvent | null> => {
    if (!event) return null;
    const res = await fetch(`/api/admin/events/${event.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to save event");
    return data.event as EditablePendingEvent;
  };

  const handleSave = async () => {
    if (!validate() || !event) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await saveEvent();
      if (updated) onSaved(updated);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndApprove = async () => {
    if (!validate() || !event) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveEvent();
      // Approve the event after saving
      const approveRes = await fetch(`/api/admin/events/${event.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!approveRes.ok) {
        const d = await approveRes.json();
        throw new Error(d.error ?? "Failed to approve event");
      }
      onSavedAndApproved(event.id);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!event} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <Input
              value={formData.title}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, title: e.target.value }));
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="Event title"
              disabled={saving}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Description <span className="text-destructive">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, description: e.target.value }));
                if (errors.description)
                  setErrors((prev) => ({ ...prev, description: undefined }));
              }}
              placeholder="Event description"
              rows={4}
              disabled={saving}
              className={cn(
                "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2",
                "text-sm ring-offset-background placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              )}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Date <span className="text-destructive">*</span>
              </label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, date: e.target.value }));
                  if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
                }}
                disabled={saving}
              />
              {errors.date && (
                <p className="text-xs text-destructive">{errors.date}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Time <span className="text-destructive">*</span>
              </label>
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, time: e.target.value }));
                  if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
                }}
                disabled={saving}
              />
              {errors.time && (
                <p className="text-xs text-destructive">{errors.time}</p>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Location <span className="text-destructive">*</span>
            </label>
            <Input
              value={formData.location}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, location: e.target.value }));
                if (errors.location)
                  setErrors((prev) => ({ ...prev, location: undefined }));
              }}
              placeholder="Building / room"
              disabled={saving}
            />
            {errors.location && (
              <p className="text-xs text-destructive">{errors.location}</p>
            )}
          </div>

          {/* Organizer */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Organizer</label>
            <Input
              value={formData.organizer}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, organizer: e.target.value }))
              }
              placeholder="Club or organizer name"
              disabled={saving}
            />
          </div>

          {/* Image URL */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Image URL</label>
            <Input
              value={formData.image_url}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, image_url: e.target.value }))
              }
              placeholder="https://..."
              disabled={saving}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Categories <span className="text-destructive">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TAGS.map((tag) => {
                const category = EVENT_CATEGORIES[tag];
                const Icon = iconMap[category.icon];
                const selected = formData.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    disabled={saving}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? cn(category.color, category.borderColor, "border-2")
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    )}
                    aria-pressed={selected}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {category.label}
                    {selected && <CheckCircle className="h-3 w-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
            {errors.tags && (
              <p className="text-xs text-destructive">{errors.tags}</p>
            )}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Save error */}
          {saveError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {saveError}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save Changes
          </Button>
          <Button
            onClick={handleSaveAndApprove}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Save &amp; Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
