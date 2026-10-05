import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Compass,
  CreditCard,
  IdCard,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  Mail,
  Menu,
  Package,
  Phone,
  PlusCircle,
  Sparkles,
  Tag,
  Ticket,
  Truck,
  User,
  Users,
  UsersRound,
  X,
  type LucideIcon,
  ClipboardCheck,
} from 'lucide-react';

/**
 * Thin compatibility layer: the existing names now render lucide icons.
 * New code should import from `lucide-react` directly.
 */
export interface IconProps {
  className?: string;
}

const base = 'h-5 w-5';

function wrap(Icon: LucideIcon) {
  return function WrappedIcon({ className = base }: IconProps) {
    return <Icon className={className} aria-hidden />;
  };
}

export const DashboardIcon = wrap(LayoutDashboard);
export const PackagesIcon = wrap(Package);
export const UsersIcon = wrap(Users);
export const ProfileIcon = wrap(User);
export const LogoutIcon = wrap(LogOut);
export const MenuIcon = wrap(Menu);
export const CloseIcon = wrap(X);
export const TagIcon = wrap(Tag);
export const GroupSizeIcon = wrap(UsersRound);
export const ChevronIcon = wrap(ChevronLeft);
export const SparkleIcon = wrap(Sparkles);
export const MailIcon = wrap(Mail);
export const LockIcon = wrap(Lock);
export const CompassIcon = wrap(Compass);
export const BriefcaseIcon = wrap(Briefcase);
export const TruckIcon = wrap(Truck);
export const ArrowRightIcon = wrap(ArrowRight);
export const PlusCircleIcon = wrap(PlusCircle);
export const BookingsIcon = wrap(Ticket);
export const CheckCircleIcon = wrap(CheckCircle2);
export const CalendarIcon = wrap(CalendarDays);
export const IdCardIcon = wrap(IdCard);
export const ReportsIcon = wrap(BarChart3);
export const PaymentIcon = wrap(CreditCard);
export const SupportIcon = wrap(LifeBuoy);
export const PhoneIcon = wrap(Phone);
export const ApprovalsIcon = wrap(ClipboardCheck);
