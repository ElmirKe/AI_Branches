import { useCallback, useRef, useState, type ClipboardEvent } from "react";
import { fileToDataUrl, ImageError, MAX_IMAGES_PER_MESSAGE, useImageUrl } from "../lib/images";
import { useT } from "../lib/i18n";
import { IconClose, IconImage } from "./Icons";

/** Картинки, которые пользователь прикрепил к сообщению, но ещё не отправил. */
export function useAttachments() {
  const t = useT();
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState("");

  const add = useCallback(
    async (files: File[]) => {
      setError("");
      const room = MAX_IMAGES_PER_MESSAGE - images.length;
      if (files.length > room) setError(t.imgMax);
      const out: string[] = [];
      for (const f of files.slice(0, Math.max(0, room))) {
        try {
          out.push(await fileToDataUrl(f));
        } catch (e) {
          setError(e instanceof ImageError && e.kind === "size" ? t.imgSize : t.imgType);
        }
      }
      if (out.length > 0) setImages((prev) => [...prev, ...out].slice(0, MAX_IMAGES_PER_MESSAGE));
    },
    [images.length, t],
  );

  /** Вставка картинки из буфера обмена (Ctrl+V) прямо в поле ввода. */
  const onPaste = useCallback(
    (e: ClipboardEvent) => {
      const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      e.preventDefault();
      void add(files);
    },
    [add],
  );

  return {
    images,
    error,
    add,
    onPaste,
    remove: (i: number) => setImages((prev) => prev.filter((_, j) => j !== i)),
    clear: () => {
      setImages([]);
      setError("");
    },
  };
}

export function AttachButton({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className="attach-btn"
        title={t.attach}
        aria-label={t.attach}
        disabled={disabled}
        onClick={() => ref.current?.click()}
      >
        <IconImage size={18} />
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function AttachPreview({ images, onRemove, error }: { images: string[]; onRemove: (i: number) => void; error: string }) {
  const t = useT();
  if (images.length === 0 && !error) return null;
  return (
    <div className="attach-row">
      {images.map((src, i) => (
        <span key={i} className="attach-thumb">
          <img src={src} alt="" />
          <button type="button" aria-label={t.removeImage} title={t.removeImage} onClick={() => onRemove(i)}>
            <IconClose size={11} />
          </button>
        </span>
      ))}
      {error && <span className="attach-error">{error}</span>}
    </div>
  );
}

/** Картинка из сообщения: по клику открывается целиком в новой вкладке. */
function Thumb({ src }: { src: string }) {
  const t = useT();
  const url = useImageUrl(src);
  if (!url) return <span className="msg-img msg-img-loading" />;
  return (
    <a
      className="msg-img"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={t.openImage}
      onClick={(e) => e.stopPropagation()}
    >
      <img src={url} alt="" loading="lazy" />
    </a>
  );
}

export function MessageImages({ images, small }: { images?: string[]; small?: boolean }) {
  if (!images || images.length === 0) return null;
  return (
    <div className={"msg-imgs" + (small ? " small" : "")}>
      {images.map((src) => (
        <Thumb key={src} src={src} />
      ))}
    </div>
  );
}
