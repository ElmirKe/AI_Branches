import type { Message } from "../types";

export const CARD_W = 200;
export const CARD_H = 78;
export const X_STEP = 300; // 200 карточка + 100 промежуток
export const V_GAP = 28; // зазор между дорожкой и ответвлениями
export const FAMILY_GAP = 1; // тонкая линия-разделитель внутри семьи
export const HEADER_H = 22; // плашка «Семья · …» над группой
export const PAD = 48;
export const ROOT_BRANCH = "Основная";

let counter = 0;
export function uid(prefix = "m"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.random().toString(36).slice(2, 6)}`;
}

export function truncate(s: string, n: number): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length <= n ? one : one.slice(0, n - 1).trimEnd() + "…";
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Узел-слияние — единственный тип узла с несколькими родителями. */
export function isMergeNode(m: Message): boolean {
  return m.parents.length > 1;
}

export interface TreeIndex {
  messages: Message[];
  byId: Map<string, Message>;
  /** узлы, поглощённые каким-либо слиянием */
  consumed: Set<string>;
  /** структурные дети (включая поглощённые) по id родителя */
  structChildren: Map<string, Message[]>;
  root: Message | undefined;
}

/**
 * Структурный родитель: для обычного узла — его родитель, для узла-слияния —
 * общий родитель слитых сестёр (рекурсивно, чтобы каскад поднимался слоями).
 */
export function structuralParentId(m: Message, byId: Map<string, Message>): string | undefined {
  if (m.parents.length === 0) return undefined;
  if (m.parents.length === 1) return m.parents[0];
  const first = byId.get(m.parents[0]);
  return first ? structuralParentId(first, byId) : undefined;
}

export function buildIndex(messages: Message[]): TreeIndex {
  const byId = new Map(messages.map((m) => [m.id, m] as const));
  const consumed = new Set<string>();
  const structChildren = new Map<string, Message[]>();
  for (const m of messages) {
    if (isMergeNode(m)) m.parents.forEach((p) => consumed.add(p));
    const pid = structuralParentId(m, byId);
    if (pid) {
      const arr = structChildren.get(pid) ?? [];
      arr.push(m);
      structChildren.set(pid, arr);
    }
  }
  return { messages, byId, consumed, structChildren, root: messages.find((m) => m.parents.length === 0) };
}

/** Родословная: путь от корня до узла (общая часть — один раз). */
export function lineage(id: string, byId: Map<string, Message>): Message[] {
  const out: Message[] = [];
  const seen = new Set<string>();
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    const pid = structuralParentId(cur, byId);
    cur = pid ? byId.get(pid) : undefined;
  }
  return out;
}

/** Сколько раз ветка сменилась на пути от корня: 0 — основная линия. */
export function forkLevel(id: string, byId: Map<string, Message>): number {
  const line = lineage(id, byId);
  let lvl = 0;
  for (let i = 1; i < line.length; i++) if (line[i].branch !== line[i - 1].branch) lvl++;
  return lvl;
}

export function hasStructChildren(id: string, idx: TreeIndex): boolean {
  return (idx.structChildren.get(id) ?? []).length > 0;
}

/** Настоящие сёстры: тот же ближайший родитель, не поглощены слиянием. */
export function sisters(id: string, idx: TreeIndex): Message[] {
  const m = idx.byId.get(id);
  if (!m || idx.consumed.has(id)) return [];
  const pid = structuralParentId(m, idx.byId);
  if (!pid) return [];
  return (idx.structChildren.get(pid) ?? []).filter((k) => k.id !== id && !idx.consumed.has(k.id));
}

/** Дети, которые показываются на холсте под узлом. */
export function displayChildren(id: string, idx: TreeIndex, expanded: Set<string>): Message[] {
  const node = idx.byId.get(id);
  const kids = (idx.structChildren.get(id) ?? []).filter((k) => !idx.consumed.has(k.id));
  if (node && isMergeNode(node) && expanded.has(id)) {
    const merged = node.parents.map((p) => idx.byId.get(p)).filter((m): m is Message => !!m);
    return [...kids, ...merged];
  }
  return kids;
}

/** Краткий итог ветки: последнее сообщение её прямого продолжения. */
export function branchSummary(m: Message, idx: TreeIndex): string {
  let cur = m;
  for (;;) {
    const next = (idx.structChildren.get(cur.id) ?? []).find((k) => k.branch === cur.branch && !isMergeNode(k));
    if (!next) break;
    cur = next;
  }
  return truncate(cur.text, 140);
}

/** Имена исходных веток: узлы-слияния раскрываются до своих листьев. */
export function leafBranchNames(m: Message, byId: Map<string, Message>): string[] {
  if (!isMergeNode(m)) return [m.branch];
  return m.parents.flatMap((p) => {
    const pm = byId.get(p);
    return pm ? leafBranchNames(pm, byId) : [];
  });
}

export function buildMergeNode(messages: Message[], ids: string[]): Message {
  const idx = buildIndex(messages);
  const members = ids.map((i) => idx.byId.get(i)).filter((m): m is Message => !!m);
  const leaves = members.flatMap((m) => leafBranchNames(m, idx.byId));
  const text =
    `Свод веток: ${leaves.join(", ")}.\n\n` +
    members.map((m) => `${m.branch} — ${branchSummary(m, idx)}`).join("\n\n");
  return {
    id: uid("merge"),
    parents: members.map((m) => m.id),
    role: "assistant",
    branch: truncate("Свод: " + leaves.join(" + "), 40),
    text,
  };
}

// ---------- раскладка ----------

export interface NodePos {
  id: string;
  x: number;
  y: number;
  depth: number;
  parentId: string | null;
  familyId: string | null;
}

export interface FamilySegment {
  top: number;
  bottom: number;
  memberIds: string[];
}

/** Семья сестёр. Если дорожка родителя проходит сквозь семью, рамка разбита на сегменты. */
export interface FamilyBox {
  id: string;
  x: number;
  label: string;
  segments: FamilySegment[];
}

export interface Edge {
  from: string;
  to: string;
  gold: boolean;
  level: number;
  d: string;
}

export interface TreeLayout {
  nodes: Map<string, NodePos>;
  families: FamilyBox[];
  edges: Edge[];
  width: number;
  height: number;
}

interface Arr {
  cont: Message | null;
  forks: Message[];
  ups: Message[]; // сверху вниз
  downs: Message[]; // сверху вниз
  header: number;
  total: number;
  lane: number; // смещение верха карточки узла внутри бокса поддерева
}

function edgePath(a: NodePos, b: NodePos): string {
  const x1 = a.x + CARD_W;
  const y1 = a.y + CARD_H / 2;
  const x2 = b.x;
  const y2 = b.y + CARD_H / 2;
  const dy = y2 - y1;
  if (Math.abs(dy) < 0.5) return `M${x1} ${y1} L${x2} ${y2}`;
  const mx = (x1 + x2) / 2;
  const s = dy > 0 ? 1 : -1;
  const r = Math.min(10, Math.abs(dy) / 2, (x2 - x1) / 2);
  const sw1 = s > 0 ? 1 : 0;
  const sw2 = s > 0 ? 0 : 1;
  return (
    `M${x1} ${y1} H${mx - r} A${r} ${r} 0 0 ${sw1} ${mx} ${y1 + s * r}` +
    ` V${y2 - s * r} A${r} ${r} 0 0 ${sw2} ${mx + r} ${y2} H${x2}`
  );
}

/**
 * Горизонтальная раскладка: глубина → X. Продолжение той же ветки остаётся
 * на дорожке родителя. Ответвления (другая ветка) стоят стопкой; если у узла
 * есть и продолжение, стопка делится по сторонам от дорожки: первое — вверх,
 * второе — вниз, третье — вверх…, а на следующем уровне порядок сторон
 * переворачивается. Без продолжения стопка центрируется на дорожке.
 */
export function computeLayout(idx: TreeIndex, expanded: Set<string>): TreeLayout {
  const nodes = new Map<string, NodePos>();
  const families: FamilyBox[] = [];
  const edges: Edge[] = [];
  if (!idx.root) return { nodes, families, edges, width: 0, height: 0 };

  const arrs = new Map<string, Arr>();
  const sum = (ms: Message[]) =>
    ms.reduce((a, m) => a + arrs.get(m.id)!.total, 0) + Math.max(0, ms.length - 1) * FAMILY_GAP;

  function measure(m: Message, depth: number): Arr {
    const kids = displayChildren(m.id, idx, expanded);
    const cont = kids.find((k) => k.branch === m.branch && !isMergeNode(k)) ?? null;
    const forks = kids.filter((k) => k !== cont);
    forks.forEach((f) => measure(f, depth + 1));
    if (cont) measure(cont, depth + 1);
    const header = forks.length >= 2 ? HEADER_H : 0;

    let arr: Arr;
    if (!cont) {
      if (forks.length === 0) {
        arr = { cont, forks, ups: [], downs: [], header, total: CARD_H, lane: 0 };
      } else {
        let y = header;
        const centers: number[] = [];
        forks.forEach((f, i) => {
          const fm = arrs.get(f.id)!;
          if (i > 0) y += FAMILY_GAP;
          centers.push(y + fm.lane + CARD_H / 2);
          y += fm.total;
        });
        const mid = (centers[0] + centers[centers.length - 1]) / 2;
        arr = { cont, forks, ups: [], downs: forks, header, total: y, lane: mid - CARD_H / 2 };
      }
    } else {
      const flip = depth % 2 === 1;
      const upsNear: Message[] = [];
      const downs: Message[] = [];
      forks.forEach((f, i) => ((i % 2 === 0) !== flip ? upsNear : downs).push(f));
      const ups = upsNear.reverse(); // ближайшая к дорожке — внизу списка
      const cm = arrs.get(cont.id)!;
      const upTotal = ups.length ? header + sum(ups) + V_GAP : 0;
      const downTotal = downs.length ? V_GAP + (ups.length ? 0 : header) + sum(downs) : 0;
      arr = { cont, forks, ups, downs, header, total: upTotal + cm.total + downTotal, lane: upTotal + cm.lane };
    }
    arrs.set(m.id, arr);
    return arr;
  }

  function place(m: Message, depth: number, top: number, parentId: string | null): void {
    const a = arrs.get(m.id)!;
    nodes.set(m.id, { id: m.id, x: PAD + depth * X_STEP, y: top + a.lane, depth, parentId, familyId: null });
    let y = top;
    const placeStack = (list: Message[]) => {
      list.forEach((f, i) => {
        if (i > 0) y += FAMILY_GAP;
        place(f, depth + 1, y, m.id);
        y += arrs.get(f.id)!.total;
      });
    };
    if (!a.cont) {
      y += a.header;
      placeStack(a.downs);
    } else {
      if (a.ups.length) {
        y += a.header;
        placeStack(a.ups);
        y += V_GAP;
      }
      place(a.cont, depth + 1, y, m.id);
      y += arrs.get(a.cont.id)!.total;
      if (a.downs.length) {
        y += V_GAP;
        if (!a.ups.length) y += a.header;
        placeStack(a.downs);
      }
    }
    if (a.forks.length >= 2) {
      const members = [...a.ups, ...a.downs];
      members.forEach((f) => (nodes.get(f.id)!.familyId = m.id));
      const mergedGroup = isMergeNode(m) && members.every((f) => m.parents.includes(f.id));
      const segment = (list: Message[]): FamilySegment => {
        const ps = list.map((f) => nodes.get(f.id)!);
        return {
          top: Math.min(...ps.map((p) => p.y)),
          bottom: Math.max(...ps.map((p) => p.y + CARD_H)),
          memberIds: list.map((f) => f.id),
        };
      };
      families.push({
        id: m.id,
        x: nodes.get(members[0].id)!.x,
        label: (mergedGroup ? "Слитые · " : "Семья · ") + truncate(m.text || m.branch, 26),
        segments: [a.ups, a.downs].filter((l) => l.length > 0).map(segment),
      });
    }
  }

  const rootArr = measure(idx.root, 0);
  place(idx.root, 0, PAD, null);

  let maxX = 0;
  for (const p of nodes.values()) {
    maxX = Math.max(maxX, p.x);
    if (!p.parentId) continue;
    const pp = nodes.get(p.parentId)!;
    const child = idx.byId.get(p.id)!;
    const parent = idx.byId.get(p.parentId)!;
    const gold = isMergeNode(child) || (isMergeNode(parent) && parent.parents.includes(child.id));
    edges.push({ from: p.parentId, to: p.id, gold, level: forkLevel(child.id, idx.byId), d: edgePath(pp, p) });
  }

  return { nodes, families, edges, width: maxX + CARD_W + PAD, height: rootArr.total + PAD * 2 };
}
