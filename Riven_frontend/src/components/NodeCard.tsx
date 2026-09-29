import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import type { Message } from "../types";
import { useStore } from "../store";
import { detectList } from "../lib/api";
import { forkLevel, hasStructChildren, isMergeNode, type NodePos } from "../lib/layout";
import { useMergeVisual } from "./MergeMode";

interface Props {
  msg: Message;
  pos: NodePos;
}

export function NodeCard({ msg, pos }: Props) {
  const { index, expandedSet, selectNode, decompose, toggleExpanded, mergeToggle } = useStore();
  const level = forkLevel(msg.id, index.byId);
  const merge = isMergeNode(msg);
  const mergeState = useMergeVisual(msg.id);

  const items =
    msg.role === "assistant" && !msg.pending && !hasStructChildren(msg.id, index) ? detectList(msg.text) : [];

  const textRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useLayoutEffect(() => {
    const el = textRef.current;
    if (el) setOverflow(el.scrollHeight > el.clientHeight + 1);
  }, [msg.text]);

  const onClick = (e: MouseEvent) => {
    e.stopPropagation(); // иначе клик дойдёт до фона холста и снимет выбор
    if (mergeState === "candidate" || mergeState === "picked") mergeToggle(msg.id);
    else if (mergeState === "none") selectNode(msg.id);
  };

  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const cls = [
    "card",
    level > 0 ? "level-fork" : "level-main",
    merge ? "merge" : "",
    pos.familyId ? "in-family" : "",
    mergeState !== "none" ? mergeState : "",
  ]
    .filter(Boolean)
    .join(" ");

  const roleLabel = merge ? "Слияние" : msg.role === "user" ? "Вы" : "Ассистент";

  return (
    <div className={cls} style={{ left: pos.x, top: pos.y }} onClick={onClick} data-id={msg.id}>
      <div className="card-head">
        <span className="caption">{roleLabel}</span>
        {items.length >= 2 && (
          <button className="card-action" onClick={stop(() => decompose(msg.id))}>
            Разложить ({items.length})
          </button>
        )}
        {merge && (
          <button className="card-action" onClick={stop(() => toggleExpanded(msg.id))}>
            {expandedSet.has(msg.id) ? "Свернуть" : `Слитые (${msg.parents.length})`}
          </button>
        )}
      </div>
      <div ref={textRef} className={"card-text" + (overflow ? " overflow" : "")}>
        {msg.pending ? <span className="pending">Печатает…</span> : msg.text}
      </div>
    </div>
  );
}
