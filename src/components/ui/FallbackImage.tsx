"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

/** `next/image` with an `onError` fallback: an expired or broken external
 * URL (e.g. a stale Instagram media URL) swaps to `fallbackSrc` once and
 * stays there — a second error on the fallback itself never loops. An empty
 * `src` renders the fallback immediately, without waiting for a load error. */
export function FallbackImage({
  src,
  alt,
  fallbackSrc = "/placeholder-event.png",
  onError,
  ...rest
}: ImageProps & { fallbackSrc?: string }) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = !src || failed ? fallbackSrc : src;
  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      onError={(event) => {
        if (!failed) setFailed(true);
        onError?.(event);
      }}
      {...rest}
    />
  );
}
