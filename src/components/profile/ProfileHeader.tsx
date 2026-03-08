"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Loader2, Pencil } from "lucide-react";
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentAvatarUrl}
      alt={name ? `${name}'s avatar` : "User avatar"}
      className="w-full h-full rounded-full object-cover"
    />
  ) : (
    <span className="text-3xl font-semibold text-red-600">
      {initials || "U"}
    </span>
  );

  return (
    <div className="relative mb-4">
      {/* Large circular avatar with primary border */}
      <div
        onClick={handleAvatarClick}
        className={`relative h-40 w-40 rounded-full border-4 border-red-600 p-1 bg-[#f8f6f6] ${
          editable ? "cursor-pointer group" : ""
        }`}
      >
        <div
          className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center ${
            currentAvatarUrl
              ? ""
              : "bg-gradient-to-br from-red-600/20 to-red-600/5"
          }`}
        >
          {avatarContent}

          {/* Upload overlay */}
          {editable && !uploading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-8 h-8 text-white" />
            </div>
          )}

          {/* Loading spinner */}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Edit button overlay on avatar */}
      {editable && (
        <button
          onClick={handleAvatarClick}
          className="absolute bottom-2 right-2 bg-red-600 text-white p-1.5 rounded-full border-2 border-white shadow-md hover:bg-red-700 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

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

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500 mt-2 text-center">{error}</p>
      )}

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
