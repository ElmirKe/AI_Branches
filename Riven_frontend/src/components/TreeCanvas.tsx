import { useMemo } from "react";
import { useStore } from "../store";
import { computeLayout } from "../lib/layout";
import { NodeCard } from "./NodeCard";
import { FamilyGroup } from "./FamilyGroup";
import { MergeMode } from "./MergeMode";

const WIDTHS = [3, 1.8, 1.2];

export function TreeCanvas() {
  const { state, currentTree, index, expandedSet, mergeCandidates, selectNode } = useStore();
  const layout = useMemo(() => computeLayout(index, expandedSet), [index, expandedSet]);
  const merging = state.merge !== null;

  const onBackground = () => {
    if (!merging) selectNode(null);
  };

  return (
    <div className="canvas">
      <header className="canvas-head">
        <h1>{currentTree.title}</h1>
        {merging ? (
          <MergeMode />
        ) : (
          <p>Кликните карточку, чтобы открыть ветку. Модель видит только путь от корня до неё.</p>
        )}
      </header>
      <div className="canvas-scroll" onClick={onBackground}>
        <div className="canvas-inner" style={{ width: layout.width, height: layout.height }}>
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
