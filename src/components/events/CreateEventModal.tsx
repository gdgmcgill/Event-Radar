"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CreateEventForm } from "@/components/events/CreateEventForm";

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  onSuccess?: () => void;
}

export function CreateEventModal({
  open,
  onOpenChange,
  clubId,
  onSuccess,
}: CreateEventModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
          <DialogDescription>
            Create a new event for your club. As an organizer, your events will be auto-approved.
          </DialogDescription>
        </DialogHeader>
        <CreateEventForm
          clubId={clubId}
          onSuccess={() => {
            onOpenChange(false);
            onSuccess?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
