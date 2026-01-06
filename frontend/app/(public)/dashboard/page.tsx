"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {BookOpen, Play, Wallet, Plus, Bell, User, Shield, Clock, ArrowUpRight, TrendingUp, TrendingDown,} from "lucide-react"

interface Book {
  id: number
  title: string
  author: string
  coverImage?: string
  progress?: number
  lastReadAt?: string
}

interface Transaction {
  id: number
  amount: number
  type: string
  reference?: string
  createdAt: string
}

interface Notification {
  id: number
  message: string
  createdAt: string
  read: boolean
}

export default function UserDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentBook, setCurrentBook] = useState<Book | null>(null)
  const [library, setLibrary] = useState<Book[]>([])
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [userEmail, setUserEmail] = useState("")

  useEffect(() => {
    const email = localStorage.getItem("email") || ""
    setUserEmail(email)

    // Mock data
    setCurrentBook({
      id: 1,
      title: "The Great Gatsby",
      author: "F. Scott Fitzgerald",
      progress: 67,
      lastReadAt: "2 hours ago",
    })

    setLibrary([
      { id: 1, title: "The Great Gatsby", author: "F. Scott Fitzgerald", progress: 67 },
      { id: 2, title: "1984", author: "George Orwell", progress: 100 },
      { id: 3, title: "To Kill a Mockingbird", author: "Harper Lee", progress: 23 },
      { id: 4, title: "Pride and Prejudice", author: "Jane Austen", progress: 0 },
      { id: 5, title: "The Catcher in the Rye", author: "J.D. Salinger", progress: 45 },
      { id: 6, title: "Animal Farm", author: "George Orwell", progress: 89 },
    ])

    setBalance(125.5)

    setTransactions([
      { id: 1, amount: 12.99, type: "DEBIT", reference: "Book Purchase", createdAt: "2024-01-15T10:30:00Z" },
      { id: 2, amount: 50.0, type: "CREDIT", reference: "Wallet Top-up", createdAt: "2024-01-14T15:20:00Z" },
      { id: 3, amount: 8.99, type: "DEBIT", reference: "Chapter Unlock", createdAt: "2024-01-13T09:45:00Z" },
    ])

    setNotifications([
      { id: 1, message: "New chapter available for The Great Gatsby", createdAt: "3 hours ago", read: false },
      { id: 2, message: "Your wallet has been topped up", createdAt: "1 day ago", read: false },
      { id: 3, message: "New book recommendation based on your reading", createdAt: "2 days ago", read: true },
    ])

    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Continue Reading Section */}
        {currentBook && (
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Continue Reading
              </CardTitle>
              <CardDescription>Pick up where you left off</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-32 h-48 bg-muted rounded-lg flex items-center justify-center shrink-0">
                  <BookOpen className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold">{currentBook.title}</h3>
                    <p className="text-muted-foreground">by {currentBook.author}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{currentBook.progress}%</span>
                    </div>
                    <Progress value={currentBook.progress} className="h-2" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Button size="lg" className="gap-2">
                      <Play className="h-4 w-4" />
                      Resume Reading
                    </Button>
                    <p className="text-sm text-muted-foreground">Last read {currentBook.lastReadAt}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: Library & Purchases */}
          <div className="lg:col-span-2 space-y-8">
            {/* My Library */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Library</CardTitle>
                    <CardDescription>Your collection of books</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {library.map((book) => (
                    <div
                      key={book.id}
                      className="group relative rounded-lg border border-border hover:border-primary/50 p-4 space-y-3 transition-all hover:shadow-lg cursor-pointer"
                    >
                      <div className="w-full aspect-[2/3] bg-muted rounded-md flex items-center justify-center">
                        <BookOpen className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-sm line-clamp-1">{book.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-1">{book.author}</p>
                      </div>
                      {book.progress !== undefined && book.progress > 0 && (
                        <div className="space-y-1">
                          <Progress value={book.progress} className="h-1" />
                          <p className="text-xs text-muted-foreground">{book.progress}% complete</p>
                        </div>
                      )}
                      {book.progress === 100 && (
                        <Badge variant="secondary" className="absolute top-2 right-2">
                          Finished
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Purchases & Access */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Purchases</CardTitle>
                <CardDescription>Your transaction history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-10 items-center justify-center rounded-full ${
                            transaction.type === "CREDIT" ? "bg-green-500/10" : "bg-red-500/10"
                          }`}
                        >
                          {transaction.type === "CREDIT" ? (
                            <TrendingUp className="size-5 text-green-600 dark:text-green-500" />
                          ) : (
                            <TrendingDown className="size-5 text-red-600 dark:text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{transaction.reference || "Transaction"}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(transaction.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`text-sm font-semibold ${
                          transaction.type === "CREDIT"
                            ? "text-green-600 dark:text-green-500"
                            : "text-red-600 dark:text-red-500"
                        }`}
                      >
                        {transaction.type === "CREDIT" ? "+" : "-"}${transaction.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Wallet, Notifications, Profile */}
          <div className="space-y-8">
            {/* Wallet Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Wallet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className="text-4xl font-bold">${balance.toFixed(2)}</p>
                </div>
                <Button className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Top Up
                </Button>
                <Separator />
                <Button variant="outline" className="w-full gap-2 bg-transparent">
                  <Clock className="h-4 w-4" />
                  Transaction History
                </Button>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {notifications.slice(0, 3).map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border ${notification.read ? "bg-transparent" : "bg-primary/5 border-primary/20"}`}
                    >
                      <p className="text-sm">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{notification.createdAt}</p>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="w-full mt-3 gap-1" size="sm">
                  View All
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>

            {/* Profile & Security */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2 bg-transparent">
                  <User className="h-4 w-4" />
                  Profile Settings
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2 bg-transparent">
                  <Shield className="h-4 w-4" />
                  Security & Privacy
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
