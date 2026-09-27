"use client";

import { useState, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  AvatarUploadResponse,
  ProfileImageFileField,
} from "@/contracts/users";
import { checkResponseInDev } from "@/lib/contractCheck";

/**
 * Development only: check the response against its contract (plan 06-11,
 * REFAC-16). Module-level, outside the hook, so the hook body holds no
 * dynamic import; in a production build the branch, and the import with it,
 * is removed.
 */
function checkUploadInDev(json: unknown) {
  if (process.env.NODE_ENV !== "production") {
    void checkResponseInDev(
      "POST /api/profile/avatar",
      (): Promise<typeof AvatarUploadResponse> =>
        import("@/contracts/users").then((m) => m.AvatarUploadResponse),
      json
    );
  }
}

export function useAvatarUpload(initialUrl: string | null | undefined) {
  const { updateUser } = useAuthStore();

  const [avatarUrl, setAvatarUrl] = useState(initialUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    setCropModalOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCropModalClose = useCallback(() => {
    setCropModalOpen(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
  }, [cropImageSrc]);

  const handleCropComplete = useCallback(
    async (blob: Blob) => {
      handleCropModalClose();
      setUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        // The field name is the route's form contract's (a type, so nothing
        // from the contract module ships to the browser).
        formData.append(
          "file" satisfies ProfileImageFileField,
          blob,
          "avatar.jpg"
        );

        const res = await fetch("/api/profile/avatar", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Upload failed");
          return;
        }

        checkUploadInDev(data);

        setAvatarUrl(data.avatar_url);
        updateUser({ avatar_url: data.avatar_url });
      } catch {
        setError("Failed to upload. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [handleCropModalClose, updateUser]
  );

  return {
    avatarUrl,
    uploading,
    error,
    cropImageSrc,
    cropModalOpen,
    fileInputRef,
    openFilePicker,
    handleFileChange,
    handleCropModalClose,
    handleCropComplete,
  };
}
