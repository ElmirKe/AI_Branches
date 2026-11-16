import {
  ArrowRight,
  ChatCircle,
  GitBranch,
  GitMerge,
  Moon,
  Plus,
  SignOut,
  Sun,
  ArrowsHorizontal,
  ArrowsVertical,
  GearSix,
  ImageSquare,
  DotsThree,
  PencilSimple,
  Trash,
  X,
} from "@phosphor-icons/react";

type P = { size?: number; className?: string };

/** Иконки: Phosphor, одно семейство и одна толщина по всему приложению. */
const W = "bold" as const;
export const IconPlus = (p: P) => <Plus weight={W} {...p} />;
export const IconChat = (p: P) => <ChatCircle weight={W} {...p} />;
export const IconSun = (p: P) => <Sun weight={W} {...p} />;
export const IconMoon = (p: P) => <Moon weight={W} {...p} />;
export const IconSend = (p: P) => <ArrowRight weight={W} {...p} />;
export const IconBranch = (p: P) => <GitBranch weight={W} {...p} />;
export const IconMerge = (p: P) => <GitMerge weight={W} {...p} />;
export const IconHoriz = (p: P) => <ArrowsHorizontal weight={W} {...p} />;
export const IconVert = (p: P) => <ArrowsVertical weight={W} {...p} />;
export const IconGear = (p: P) => <GearSix weight={W} {...p} />;
export const IconImage = (p: P) => <ImageSquare weight={W} {...p} />;
export const IconDots = (p: P) => <DotsThree weight={W} {...p} />;
export const IconEdit = (p: P) => <PencilSimple weight={W} {...p} />;
export const IconTrash = (p: P) => <Trash weight={W} {...p} />;
export const IconClose = (p: P) => <X weight={W} {...p} />;
export const IconLogout = (p: P) => <SignOut weight={W} {...p} />;

/** Компактный знак для маленьких мест (вкладка, аватар). */
export { Mark as Logo } from "./Brand";
