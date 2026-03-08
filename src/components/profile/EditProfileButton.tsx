"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import EditProfileModal from "./EditProfileModal";
import type { EventTag } from "@/types";

type EditProfileButtonProps = {
    userId: string;
    initialName: string;
    initialAvatarUrl: string;
    initialTags: EventTag[];
    initialPronouns?: string;
    initialYear?: string;
    initialFaculty?: string;
    initialVisibility?: string;
};

export default function EditProfileButton(props: EditProfileButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2"
            >
                <Pencil className="h-4 w-4" /> Edit Profile
            </button>

            <EditProfileModal
                open={open}
                onOpenChange={setOpen}
                {...props}
            />
        </>
    );
}
