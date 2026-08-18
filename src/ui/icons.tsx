import {
  Folder,
  Inbox,
  CheckCircle,
  Circle,
  MoreVertical,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Share,
  Settings,
  Copy,
  ArrowUpRight,
  Trash2,
  Pencil,
  ArrowLeft,
  CornerDownRight,
  FolderPlus,
  ArrowRight,
  User,
  LogIn,
  LogOut
} from 'lucide-react';

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
  copy: Copy,
  arrowUpRight: ArrowUpRight,
  trash: Trash2,
  edit: Pencil,
  arrowLeft: ArrowLeft,
  cornerDownRight: CornerDownRight,
  folderPlus: FolderPlus,
  arrowRight: ArrowRight,
  user: User,
  logIn: LogIn,
  logOut: LogOut,
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const Component = ICONS[name];
  if (!Component) return null;
  return <Component className={className} size={20} />;
}
