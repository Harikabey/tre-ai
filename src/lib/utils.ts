// FILE: src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(pointer: coarse)").matches;
  }

  return navigator.maxTouchPoints > 0;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
