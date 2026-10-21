"use client";

import { useEffect, useRef } from "react";

const SENSITIVITY = 0.8;

/* Full-bleed hero video, scrubbed by horizontal mouse movement rather than
 * played. Seeks are queued one at a time via onSeeked — writing currentTime on
 * every mousemove floods the decoder and the picture stops updating. Touch
 * devices have no mouse, so they get a quiet loop instead of a frozen frame,
 * and anyone who asked for less motion gets a still. */
export default function ScrubVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const targetTime = useRef(0);
  const seeking = useRef(false);
  const prevX = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onReady = () => {
      const d = video.duration;
      if (!d || !Number.isFinite(d)) return;
      if (coarse && !still) {
        video.loop = true;
        void video.play().catch(() => {});
        return;
      }
      targetTime.current = d * 0.45; // frame 0 is often blank
      seeking.current = true;
      video.currentTime = targetTime.current;
    };

    if (video.readyState >= 1) onReady();
    else video.addEventListener("loadedmetadata", onReady, { once: true });

    if (coarse || still) return;

    const onMove = (e: MouseEvent) => {
      const d = video.duration;
      if (!d || !Number.isFinite(d)) return;
      if (prevX.current === null) { prevX.current = e.clientX; return; }
      const delta = e.clientX - prevX.current;
      prevX.current = e.clientX;
      if (delta === 0) return;
      const offset = (delta / window.innerWidth) * SENSITIVITY * d;
      targetTime.current = Math.min(Math.max(targetTime.current + offset, 0), d);
      if (!seeking.current) { seeking.current = true; video.currentTime = targetTime.current; }
    };

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      video.removeEventListener("loadedmetadata", onReady);
    };
  }, []);

  const handleSeeked = () => {
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - targetTime.current) > 0.01) video.currentTime = targetTime.current;
    else seeking.current = false;
  };

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      playsInline
      preload="auto"
      aria-hidden
      onSeeked={handleSeeked}
      style={{ position: "absolute", inset: 0, zIndex: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "70% center" }}
    />
  );
}
