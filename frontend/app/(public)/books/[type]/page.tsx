import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    BookOpen,
    User,
    Palette,
    Zap,
    Feather,
    LucideIcon
} from "lucide-react"

interface TypeTheme {
    label: string
    description: string
    icon: LucideIcon
    color: string
    bgColor: string
    borderColor: string
    headerGradient: string
}

const TYPE_THEMES: Record<string, TypeTheme> = {
    manga: {
        label: "Manga Collection",
        description: "Explore traditional Japanese comics and graphic novels.",
        icon: Palette,
        color: "text-slate-900",
        bgColor: "bg-slate-50",
        borderColor: "border-slate-200",
        headerGradient: "from-slate-800 to-gray-600",
    },
    manhwa: {
        label: "Manhwa Universe",
        description: "Dive into the vibrant world of South Korean webtoons.",
        icon: Palette,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
        headerGradient: "from-blue-600 to-cyan-500",
    },
    comic: {
        label: "Western Comics",
        description: "Superheroes, villains, and epic adventures.",
        icon: Zap,
        color: "text-yellow-600",
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-200",
        headerGradient: "from-red-600 to-yellow-500",
    },
    novel: {
        label: "Novel",
        description: "Immersive text-based stories to ignite your imagination.",
        icon: Feather,
        color: "text-emerald-700",
        bgColor: "bg-emerald-50",
        borderColor: "border-emerald-200",
        headerGradient: "from-emerald-700 to-teal-600",
    },
    "light-novel": {
        label: "Light Novel",
        description: "Short, illustrated Japanese novels targeting young adults.",
        icon: BookOpen,
        color: "text-pink-600",
        bgColor: "bg-pink-50",
        borderColor: "border-pink-200",
        headerGradient: "from-pink-500 to-rose-400",
    }
}

function getTypeTheme(type: string) {
    return TYPE_THEMES[type.toLowerCase()] || TYPE_THEMES.manga
}

async function getBooksByType(type: string) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/books/type/${type}`, {
        cache: "no-store",
    })

    if (!res.ok) return []
    return res.json()
}

export default async function BookTypePage({ params }: { params: Promise<{ type: string }> }) {
    const { type } = await params

    const books = await getBooksByType(type)

    const theme = getTypeTheme(type)
    const ThemeIcon = theme.icon

    return (
        <div className="container mx-auto px-4 py-8">

            <div className={`mb-10 rounded-2xl p-8 text-white bg-gradient-to-r ${theme.headerGradient} shadow-lg relative overflow-hidden`}>
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <ThemeIcon className="w-32 h-32" />
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shadow-inner">
                        <ThemeIcon className="h-10 w-10 text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight">{theme.label}</h1>
                        <p className="text-white/90 text-lg mt-1">
                            {theme.description}
                        </p>
                    </div>
                </div>
            </div>

            {books.length === 0 ? (
                <div className={`py-16 text-center border-2 border-dashed rounded-xl ${theme.bgColor} ${theme.borderColor}`}>
                    <ThemeIcon className={`mx-auto h-16 w-16 mb-4 opacity-30 ${theme.color}`} />
                    <h3 className="text-xl font-medium text-slate-800">No {theme.label} Found</h3>
                    <p className="text-muted-foreground mt-2">
                        We haven't added any books to this category yet.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {books.map((book: any) => (
                        <Card
                            key={book.id}
                            className={`group hover:shadow-xl transition-all duration-300 overflow-hidden border ${theme.borderColor} bg-card`}
                        >
                            <div className="aspect-[2/3] relative bg-muted overflow-hidden">
                                {book.coverImage ? (
                                    <img
                                        src={`${process.env.NEXT_PUBLIC_API_BASE}/media/${book.coverImage}`}
                                        alt={book.title}
                                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className={`flex items-center justify-center h-full ${theme.bgColor}`}>
                                        <ThemeIcon className={`h-12 w-12 opacity-20 ${theme.color}`} />
                                    </div>
                                )}

                                <div className="absolute top-2 left-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-black/70 text-white backdrop-blur`}>
                        {type}
                    </span>
                                </div>
                            </div>

                            <CardHeader className="p-4 space-y-1">
                                <CardTitle className={`line-clamp-1 text-base group-hover:${theme.color} transition-colors`}>
                                    {book.title}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-1 text-xs truncate">
                                    <User className="h-3 w-3" />
                                    {book.author || "Unknown Author"}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}