"use client";

import { useState, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";

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
        formData.append("file", blob, "avatar.jpg");

        const res = await fetch("/api/profile/avatar", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Upload failed");
          return;
        }

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
