"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import EditProfileModal from "./EditProfileModal";
import type { EventTag } from "@/types";

type EditProfileButtonProps = {
    userId: string;
    initialName: string;
    initialAvatarUrl: string;
    initialTags: EventTag[];
};

export default function EditProfileButton(props: EditProfileButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                variant="outline"
                size="sm"
                className="gap-2"
            >
                <Pencil className="w-4 h-4" />
                Edit Profile
            </Button>

            <EditProfileModal
                open={open}
                onOpenChange={setOpen}
                {...props}
            />
        </>
    );
}
