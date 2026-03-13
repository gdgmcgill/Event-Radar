"use client";

import { Camera, Loader2, Pencil } from "lucide-react";
import AvatarCropModal from "@/components/profile/AvatarCropModal";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";

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
  avatarUrl: initialAvatarUrl,
  editable = false,
}: ProfileHeaderProps) {
  const {
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
  } = useAvatarUpload(initialAvatarUrl);

  const initials = (name || email || "")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const avatarContent = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
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
        onClick={editable ? openFilePicker : undefined}
        className={`relative h-40 w-40 rounded-full border-4 border-red-600 p-1 bg-[#f8f6f6] ${
          editable ? "cursor-pointer group" : ""
        }`}
      >
        <div
          className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center ${
            avatarUrl
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
          onClick={openFilePicker}
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
