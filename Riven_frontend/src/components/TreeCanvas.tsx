import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { CARD_H, CARD_W, computeLayout } from "../lib/layout";
import { NodeCard } from "./NodeCard";
import { FamilyGroup } from "./FamilyGroup";
import { MergeMode } from "./MergeMode";
import { displayTitle, useLang, useT } from "../lib/i18n";

const WIDTHS = [3, 1.8, 1.2];

export function TreeCanvas() {
  const { state, currentTree, index, expandedSet, mergeCandidates, selectNode, setOrientation } = useStore();
  const orientation = state.orientation;
  const t = useT();
  const lang = useLang();
  const layout = useMemo(
    () => computeLayout(index, expandedSet, orientation, currentTree.familyTitles),
    [index, expandedSet, orientation, currentTree.familyTitles],
  );
  const merging = state.merge !== null;

  // Основная линия чата должна идти по центру экрана (поперёк роста дерева):
  // по вертикали в горизонтальном режиме, по горизонтали в вертикальном.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const horizontal = orientation === "horizontal";
  const rootPos = index.root ? layout.nodes.get(index.root.id) : undefined;
  const mainCross = rootPos ? (horizontal ? rootPos.y + CARD_H / 2 : rootPos.x + CARD_W / 2) : 0;
  const viewCross = horizontal ? size.h : size.w;
  // если дерево помещается — сдвигаем его так, чтобы магистраль была посередине
  const offset = viewCross > 0 ? Math.max(0, Math.round(viewCross / 2 - mainCross)) : 0;
  // если дерево больше экрана — один раз прокручиваем к магистрали при открытии чата / смене режима
  const lastCentered = useRef("");
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const key = `${currentTree.id}:${orientation}:${viewCross > 0}`;
    if (!el || viewCross === 0 || lastCentered.current === key) return;
    lastCentered.current = key;
    const target = Math.max(0, Math.round(mainCross + offset - viewCross / 2));
    if (horizontal) el.scrollTop = target;
    else el.scrollLeft = target;
  }, [currentTree.id, orientation, viewCross, mainCross, offset, horizontal]);

  const onBackground = () => {
    if (!merging) selectNode(null);
  };

  return (
    <div className="canvas">
      <header className="canvas-head">
        <div className="canvas-head-row">
          <h1>{displayTitle(currentTree.title, lang)}</h1>
          <div className="orient-switch" role="group" aria-label={t.treeDirection}>
            <button
              className={orientation === "horizontal" ? "active" : ""}
              aria-pressed={orientation === "horizontal"}
              onClick={() => setOrientation("horizontal")}
              title={t.horizontalHint}
            >
              ↔ {t.horizontal}
            </button>
            <button
              className={orientation === "vertical" ? "active" : ""}
              aria-pressed={orientation === "vertical"}
              onClick={() => setOrientation("vertical")}
              title={t.verticalHint}
            >
              ↕ {t.vertical}
            </button>
          </div>
        </div>
        {merging ? (
          <MergeMode />
        ) : (
          <p>{t.canvasHint}</p>
        )}
      </header>
      <div className="canvas-scroll" ref={scrollRef} onClick={onBackground}>
        <div
          className="canvas-inner"
          style={{
            width: layout.width,
            height: layout.height,
            minWidth: 0,
            minHeight: 0,
            marginTop: horizontal ? offset : 0,
            marginLeft: horizontal ? 0 : offset,
          }}
        >
          <svg width={layout.width} height={layout.height}>
            {layout.edges.map((e) => (
              <path
                key={e.to}
                d={e.d}
                fill="none"
                stroke={e.gold ? "var(--gold)" : e.level === 0 ? "var(--main-line)" : "var(--fork-line)"}
                strokeWidth={WIDTHS[Math.min(e.level, WIDTHS.length - 1)]}
                strokeLinecap="round"
              />
            ))}
          </svg>
          {layout.families.map((f) => (
            <FamilyGroup
              key={f.id}
              family={f}
              nodes={layout.nodes}
              orientation={orientation}
              dimmed={
                merging &&
                !f.segments.some((seg) =>
                  seg.memberIds.some((id) => id === state.merge?.anchorId || mergeCandidates.has(id)),
                )
              }
            />
          ))}
          {[...layout.nodes.values()].map((pos) => {
            const msg = index.byId.get(pos.id);
            return msg ? <NodeCard key={pos.id} msg={msg} pos={pos} /> : null;
          })}
        </div>
      </div>
    </div>
  );
}
