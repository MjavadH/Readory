import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    BookOpen,
    Calendar,
    User,
    Heart,      // Romance
    Sword,      // Action
    Ghost,      // Horror
    Zap,        // Fantasy/Sci-Fi
    Search,     // Mystery
    LucideIcon
} from "lucide-react"

interface GenreTheme {
    primaryColor: string
    secondaryBg: string
    borderColor: string
    icon: LucideIcon
    gradient: string
}

const GENRE_THEMES: Record<string, GenreTheme> = {
    // Romance Theme (Pink/Rose)
    romance: {
        primaryColor: "text-rose-600",
        secondaryBg: "bg-rose-50",
        borderColor: "border-rose-200",
        icon: Heart,
        gradient: "from-rose-500 to-pink-500",
    },
    // Action Theme (Red/Orange)
    action: {
        primaryColor: "text-red-600",
        secondaryBg: "bg-red-50",
        borderColor: "border-red-200",
        icon: Sword,
        gradient: "from-red-600 to-orange-600",
    },
    // Horror Theme (Purple/Slate)
    horror: {
        primaryColor: "text-purple-900",
        secondaryBg: "bg-slate-900",
        borderColor: "border-purple-900",
        icon: Ghost,
        gradient: "from-slate-900 to-purple-900",
    },
    // Fantasy Theme (Indigo/Violet)
    fantasy: {
        primaryColor: "text-indigo-600",
        secondaryBg: "bg-indigo-50",
        borderColor: "border-indigo-200",
        icon: Zap,
        gradient: "from-indigo-500 to-violet-500",
    },
    // Default Theme (Slate/Gray) - Fallback
    default: {
        primaryColor: "text-slate-700",
        secondaryBg: "bg-slate-50",
        borderColor: "border-slate-200",
        icon: BookOpen,
        gradient: "from-slate-700 to-slate-500",
    }
}

function getGenreTheme(slug: string): GenreTheme {
    return GENRE_THEMES[slug.toLowerCase()] || GENRE_THEMES.default
}

async function getGenre(slug: string) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/genres/${slug}`, {
        cache: "no-store",
    })

    if (!res.ok) return null
    return res.json()
}

export default async function GenrePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const genre = await getGenre(slug)

    if (!genre) {
        notFound()
    }

    const theme = getGenreTheme(slug)
    const ThemeIcon = theme.icon

    return (
        <div className="container mx-auto px-4 py-8">

            {/* Dynamic Header */}
            <div className={`mb-10 rounded-2xl p-8 text-white bg-gradient-to-r ${theme.gradient} shadow-lg`}>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                        <ThemeIcon className="h-10 w-10 text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight capitalize">{genre.name}</h1>
                        <p className="text-white/90 text-lg mt-1">
                            Browse our best collection of {genre.name} books
                        </p>
                    </div>
                </div>
            </div>

            {genre.books.length === 0 ? (
                <div className={`py-12 text-center border-2 border-dashed rounded-xl ${theme.secondaryBg} ${theme.borderColor}`}>
                    <ThemeIcon className={`mx-auto h-12 w-12 mb-3 opacity-50 ${theme.primaryColor}`} />
                    <h3 className="text-lg font-medium">No books found</h3>
                    <p className="text-muted-foreground">
                        We haven't added any books to this genre yet.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {genre.books.map((book: any) => (
                        <Card
                            key={book.id}
                            className={`group hover:shadow-xl transition-all duration-300 overflow-hidden border-2 ${theme.borderColor}`}
                        >
                            <div className="aspect-[2/3] relative bg-muted/50 overflow-hidden">
                                {book.coverImage ? (
                                    <img
                                        src={`${process.env.NEXT_PUBLIC_API_BASE}/media/${book.coverImage}`}
                                        alt={book.title}
                                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className={`flex items-center justify-center h-full ${theme.secondaryBg}`}>
                                        <ThemeIcon className={`h-12 w-12 opacity-20 ${theme.primaryColor}`} />
                                    </div>
                                )}

                                {/* Overlay Badge specific to genre */}
                                <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 text-xs font-bold rounded-md bg-white/90 backdrop-blur shadow-sm ${theme.primaryColor}`}>
                        {genre.name}
                    </span>
                                </div>
                            </div>

                            <CardHeader className="p-4 space-y-1">
                                <CardTitle className={`line-clamp-1 text-lg leading-tight group-hover:${theme.primaryColor} transition-colors`}>
                                    {book.title}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-1 text-xs">
                                    <User className="h-3 w-3" />
                                    {book.author || "Unknown Author"}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="p-4 pt-0">
                                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(book.updatedAt).toLocaleDateString()}
                                    </div>

                                    {/* Theme-colored icon at the bottom */}
                                    <ThemeIcon className={`h-4 w-4 opacity-50 ${theme.primaryColor}`} />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}