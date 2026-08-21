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
  LogOut,
  X,
  Bell,
  BellOff,
  Clock,
  Calendar,
  Repeat,
  Briefcase,
  Book,
  Home,
  ShoppingCart,
  Heart,
  Star,
  Film,
  Music,
  Code,
  Coffee,
  Utensils,
  Car,
  Plane,
  Smile,
  Zap,
  Target,
  Gift,
  Tag,
  Compass,
  MapPin,
  Camera,
  Sun,
  Moon,
  Flag,
  Bookmark,
  Archive,
  Award,
  Shield,
  Wrench,
  Activity,
  Cloud,
  Mail,
  DollarSign,
  Lightbulb,
  GraduationCap,
  Dumbbell,
  Sparkles,
  Palette,
  GripVertical,
  Link as LinkIcon
} from 'lucide-react';
import type { SVGProps } from 'react';

function TalikaLogoIcon({ size = 20, className, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M4 6.5h16" />
      <path d="M7.8 8.8c.4-.6-.4-1.2-1.1-.7-1 .7-1.2 3.8.2 6 1 .9 2.4.4 2.5-1.5.1-1.8.7-.3 1.3 1.3.3.8.7 1.7.9 1.7" />
      <path d="M17 6.5v10.5" />
    </svg>
  );
}

export const ICONS = {
  // Navigation & Core UI
  logo: TalikaLogoIcon,
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
  link: LinkIcon,
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
  x: X,
  bell: Bell,
  bellOff: BellOff,
  clock: Clock,
  calendar: Calendar,
  repeat: Repeat,
  gripVertical: GripVertical,

  // Curated Folder Icons
  briefcase: Briefcase,
  book: Book,
  home: Home,
  shoppingCart: ShoppingCart,
  heart: Heart,
  star: Star,
  film: Film,
  music: Music,
  code: Code,
  coffee: Coffee,
  utensils: Utensils,
  car: Car,
  plane: Plane,
  smile: Smile,
  zap: Zap,
  target: Target,
  gift: Gift,
  tag: Tag,
  compass: Compass,
  mapPin: MapPin,
  camera: Camera,
  sun: Sun,
  moon: Moon,
  flag: Flag,
  bookmark: Bookmark,
  archive: Archive,
  award: Award,
  shield: Shield,
  tool: Wrench,
  activity: Activity,
  cloud: Cloud,
  mail: Mail,
  dollarSign: DollarSign,
  lightbulb: Lightbulb,
  graduationCap: GraduationCap,
  dumbbell: Dumbbell,
  sparkles: Sparkles,
  palette: Palette,
};

export const CURATED_FOLDER_ICONS = [
  'folder',
  'briefcase',
  'book',
  'home',
  'shoppingCart',
  'heart',
  'star',
  'film',
  'music',
  'code',
  'coffee',
  'utensils',
  'car',
  'plane',
  'smile',
  'zap',
  'target',
  'gift',
  'tag',
  'compass',
  'mapPin',
  'camera',
  'sun',
  'moon',
  'flag',
  'bookmark',
  'archive',
  'award',
  'shield',
  'tool',
  'activity',
  'cloud',
  'mail',
  'dollarSign',
  'lightbulb',
  'graduationCap',
  'dumbbell',
  'sparkles',
  'palette',
] as const;

export const DEFAULT_FOLDER_ICON: IconName = 'folder';

export type IconName = keyof typeof ICONS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const Component = ICONS[name];
  if (!Component) return null;
  return <Component className={className} size={20} />;
}
