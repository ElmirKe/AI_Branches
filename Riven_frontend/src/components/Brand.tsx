/** Элементы айдентики Riven: знак-дерево, вордмарк (из логотипа), слоган. */

/** Знак: три узла и ветвление. Рисуется из CSS-переменных, поэтому работает в обеих темах. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size * 0.82} viewBox="0 0 66 54" fill="none" aria-hidden>
      <path d="M33 16V34M33 16C33 26 10 24 10 34M33 16C33 26 56 24 56 34" className="mark-line" />
      <rect x="25" y="2" width="16" height="14" rx="4" className="mark-top" />
      <rect x="2" y="34" width="16" height="14" rx="4" className="mark-dim" />
      <rect x="25" y="34" width="16" height="14" rx="4" className="mark-lit" />
      <rect x="48" y="34" width="16" height="14" rx="4" className="mark-dim" />
    </svg>
  );
}

export function Wordmark({ height = 28 }: { height?: number }) {
  return <img className="wordmark" src="/riven-wordmark.png" alt="Riven" height={height} style={{ height }} />;
}

export function Tagline() {
  return (
    <p className="tagline">
      Talk. Explore. <b>Branch.</b>
    </p>
  );
}

/** Нижняя «подпись»: знак по центру и тонкие линии по бокам, как на баннере. */
export function BrandRule() {
  return (
    <div className="brand-rule" aria-hidden>
      <i />
      <Mark size={44} />
      <i />
    </div>
  );
}
