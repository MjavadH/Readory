import {
    BookMarked, Sparkles, ScrollText, Feather, PenLine,
    Shield, Swords, Compass, Heart, Ghost, Laugh, Wand2,
    Skull, Flame, Globe, Home, BookOpen, Library, LayoutDashboard,
    Watch, Volleyball, GraduationCap, Rocket, Search, RefreshCcw,
    MessageCircleHeartIcon, Sword, HeartCrack, CalendarRange, Wallet,
    Pen, Languages, Palette, Edit, Eraser, Type, FileImage, UserCheck

} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IconKey } from "@readory/shared";

export const iconRegistry: Record<IconKey, LucideIcon> = {
    manga: BookMarked,
    manhwa: Sparkles,
    comic: ScrollText,
    novel: Feather,
    lightNovel: PenLine,
    shield: Shield,
    action: Swords,
    adventure: Compass,
    romance: Heart,
    horror: Ghost,
    comedy: Laugh,
    fantasy: Wand2,
    thriller: Skull,
    drama: Flame,
    "sci-fi": Globe,
    home: Home,
    bookOpen: BookOpen,
    library: Library,
    layoutDashboard: LayoutDashboard,
    timeTravel: Watch,
    sports: Volleyball,
    schoolLife: GraduationCap,
    isekai: Rocket,
    mystery: Search,
    reincarnation: RefreshCcw,
    shoujo: MessageCircleHeartIcon,
    shounen: Sword,
    tragedy: HeartCrack,
    sliceOfLife: CalendarRange,
    wallet: Wallet,
    author: Pen,
    translator: Languages,
    illustrator: Palette,
    editor: Edit,
    cleaner: Eraser,
    typesetter: Type,
    rawProvider: FileImage,
    supervisor: UserCheck,
} as const;

