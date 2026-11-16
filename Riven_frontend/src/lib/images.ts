import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Картинки в сообщениях.
 * Пока картинка не загружена, в сообщении лежит её data:URL (сжатый JPEG).
 * После загрузки в Supabase Storage (бакет images, папка userId/chatId) — путь к файлу.
 */
export const BUCKET = "images";
export const MAX_IMAGES_PER_MESSAGE = 3;
const MAX_SIDE = 1600;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

export const isDataUrl = (s: string) => s.startsWith("data:");

export class ImageError extends Error {
  constructor(public kind: "type" | "size") {
    super(kind);
  }
}

/** Сжимает картинку до 1600 пикселей по большей стороне и переводит в JPEG. */
export async function fileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new ImageError("type");
  if (file.size > MAX_INPUT_BYTES) throw new ImageError("size");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ImageError("type"));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("type");
    ctx.fillStyle = "#ffffff"; // прозрачный фон PNG иначе станет чёрным
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function randomId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return c && typeof c.randomUUID === "function" ? c.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Загружает картинку в хранилище, возвращает путь к файлу. */
export async function uploadImage(userId: string, chatId: string, dataUrl: string): Promise<string> {
  if (!supabase) throw new Error("Supabase не настроен");
  const path = `${userId}/${chatId}/${randomId()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, dataUrlToBlob(dataUrl), {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

/** Удаляет все картинки чата. Ошибки не мешают удалению самого чата. */
export async function deleteChatImages(userId: string, chatId: string): Promise<void> {
  if (!supabase) return;
  const folder = `${userId}/${chatId}`;
  const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000 });
  const names = (data ?? []).map((f) => `${folder}/${f.name}`);
  if (names.length > 0) await supabase.storage.from(BUCKET).remove(names);
}

// ---------- временные ссылки на картинки ----------

const TTL_SEC = 60 * 60;
const cache = new Map<string, { url: string; until: number }>();
const waiting = new Map<string, Promise<string | null>>();

/** Ссылка, по которой можно показать картинку или отдать её ИИ (живёт около часа). */
export async function imageUrl(src: string): Promise<string | null> {
  if (isDataUrl(src) || src.startsWith("https://")) return src;
  const hit = cache.get(src);
  if (hit && hit.until > Date.now() + 60_000) return hit.url;
  const pending = waiting.get(src);
  if (pending) return pending;
  const p = (async () => {
    if (!supabase) return null;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(src, TTL_SEC);
    if (error || !data?.signedUrl) return null;
    cache.set(src, { url: data.signedUrl, until: Date.now() + TTL_SEC * 1000 });
    return data.signedUrl;
  })().finally(() => waiting.delete(src));
  waiting.set(src, p);
  return p;
}

/** То же для компонента: null, пока ссылка не готова. */
export function useImageUrl(src: string): string | null {
  const [url, setUrl] = useState<string | null>(() => (isDataUrl(src) ? src : (cache.get(src)?.url ?? null)));
  useEffect(() => {
    let alive = true;
    imageUrl(src).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [src]);
  return url;
}
