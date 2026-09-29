import { CARD_H, CARD_W, type FamilyBox, type NodePos } from "../lib/layout";

interface Props {
  family: FamilyBox;
  nodes: Map<string, NodePos>;
  dimmed: boolean;
}

const BORDER = 1.5;

/**
 * Обёртка семьи сестёр: подложка под карточками (z 1) и рамка поверх них
 * (z 3, без перехвата кликов). Плашка — только на верхнем сегменте.
 * Сами карточки рендерит холст.
 */
export function FamilyGroup({ family, nodes, dimmed }: Props) {
  return (
    <>
      {family.segments.map((seg, si) => {
        const box = { left: family.x, top: seg.top, width: CARD_W, height: seg.bottom - seg.top };
        const members = seg.memberIds.map((id) => nodes.get(id)!);
        const dividers: number[] = [];
        for (let i = 0; i < members.length - 1; i++) {
          const mid = (members[i].y + CARD_H + members[i + 1].y) / 2;
          dividers.push(mid - seg.top - BORDER);
        }
        return (
          <div key={si} style={{ display: "contents" }}>
            <div className={"family-bg" + (si > 0 ? " family-cont" : "")} style={box} />
            <div className={"family-frame" + (dimmed ? " dimmed" : "") + (si > 0 ? " family-cont" : "")} style={box}>
              {si === 0 && (
                <div className="family-label" title={family.label}>
                  {family.label}
                </div>
              )}
              {dividers.map((y, i) => (
                <div key={i} className="family-divider" style={{ top: y }} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
