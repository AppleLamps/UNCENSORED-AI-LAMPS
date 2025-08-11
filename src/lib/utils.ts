import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function ensureOnlineSlug(model: string): string {
  return model.includes(":online") ? model : `${model}:online`;
}
