import { CARD_H, CARD_W, type FamilyBox, type NodePos } from "../lib/layout";
import type { Orientation } from "../types";

interface Props {
  family: FamilyBox;
  nodes: Map<string, NodePos>;
  orientation: Orientation;
  dimmed: boolean;
}

const BORDER = 1.5;

/**
 * Обёртка семьи сестёр: подложка под карточками (z 1) и рамка поверх них
 * (z 3, без перехвата кликов). Плашка «Семья · …» есть у тех сегментов, где layout
 * её разрешил (labeled): у сплошного блока — одна сверху, у разделённого дорожкой — по одной на часть.
 * Сами карточки рендерит холст.
 */
export function FamilyGroup({ family, nodes, orientation, dimmed }: Props) {
  const horizontal = orientation === "horizontal";
  return (
    <>
      {family.segments.map((seg, si) => {
        const box = horizontal
          ? { left: family.along, top: seg.start, width: CARD_W, height: seg.end - seg.start }
          : { left: seg.start, top: family.along, width: seg.end - seg.start, height: CARD_H };
        const members = seg.memberIds.map((id) => nodes.get(id)!);
        const dividers: number[] = [];
        for (let i = 0; i < members.length - 1; i++) {
          const mid = horizontal
            ? (members[i].y + CARD_H + members[i + 1].y) / 2 - seg.start
            : (members[i].x + CARD_W + members[i + 1].x) / 2 - seg.start;
          dividers.push(mid - BORDER);
        }
        const cont = seg.labeled ? "" : " family-cont";
        return (
          <div key={si} style={{ display: "contents" }}>
            <div className={"family-bg" + cont} style={box} />
            <div className={"family-frame" + (dimmed ? " dimmed" : "") + cont} style={box}>
              {seg.labeled && (
                <div className="family-label" title={family.label}>
                  {family.label}
                </div>
              )}
              {dividers.map((d, i) => (
                <div
                  key={i}
                  className={"family-divider" + (horizontal ? "" : " family-divider-v")}
                  style={horizontal ? { top: d } : { left: d }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
