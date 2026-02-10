import {
    BookMarked, Sparkles, ScrollText, Feather, PenLine,
    Shield, Swords, Compass, Heart, Ghost, Laugh, Wand2,
    Skull, Flame, Globe, Home, BookOpen, Library, LayoutDashboard,
    Watch, Volleyball, GraduationCap, Rocket, Search, RefreshCcw,
    MessageCircleHeartIcon, Sword, HeartCrack, CalendarRange,

} from "lucide-react";

export const iconRegistry = {
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
    Isekai: Rocket,
    Mystery: Search,
    Reincarnation: RefreshCcw,
    Shoujo: MessageCircleHeartIcon,
    Shounen: Sword,
    Tragedy: HeartCrack,
    SliceOfLife: CalendarRange,
} as const;

export type IconKey = keyof typeof iconRegistry;
