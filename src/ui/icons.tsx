import { Folder, Inbox, CheckCircle, Circle, MoreVertical, Plus, Search, ChevronRight, ChevronDown, Share, Settings } from 'lucide-react';

export const ICONS = {
  folder: Folder,
  inbox: Inbox,
  check: CheckCircle,
  circle: Circle,
  more: MoreVertical,
  plus: Plus,
  search: Search,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  share: Share,
  settings: Settings,
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const Component = ICONS[name];
  if (!Component) return null;
  return <Component className={className} size={20} />;
}
