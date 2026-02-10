"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Camera, Loader2 } from "lucide-react";
import AvatarCropModal from "@/components/profile/AvatarCropModal";

type ProfileHeaderProps = {
  name?: string | null;
  email?: string;
  avatarUrl?: string | null;
  userId?: string;
  editable?: boolean;
};

export default function ProfileHeader({
  name,
  email,
  avatarUrl,
  userId,
  editable = false,
}: ProfileHeaderProps) {
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = (name || email || "")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleAvatarClick = () => {
    if (editable && !uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    setCropModalOpen(true);

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

        setCurrentAvatarUrl(data.avatar_url);
      } catch {
        setError("Failed to upload avatar. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [handleCropModalClose]
  );

  const avatarContent = currentAvatarUrl ? (
    <Image
      src={currentAvatarUrl}
      alt={name ?? "avatar"}
      fill
      className="object-cover"
    />
  ) : (
    <span className="text-2xl font-semibold text-primary">
      {initials || "U"}
    </span>
  );

  return (
    <div className="flex items-center gap-6">
      {/* Avatar */}
      <div className="relative">
        <div
          onClick={handleAvatarClick}
          className={`relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-background shadow-xl flex items-center justify-center ${
            currentAvatarUrl
              ? ""
              : "bg-gradient-to-br from-primary/20 to-primary/5"
          } ${editable ? "cursor-pointer group" : ""}`}
        >
          {avatarContent}

          {/* Upload overlay */}
          {editable && !uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>
          )}

          {/* Loading spinner */}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Hidden file input */}
        {editable && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />
        )}
      </div>

      {/* User Info */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {name ?? email ?? "User"}
        </h1>
        {email && (
          <p className="text-sm text-muted-foreground">{email}</p>
        )}
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>

      {cropImageSrc && (
        <AvatarCropModal
          open={cropModalOpen}
          onClose={handleCropModalClose}
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}
