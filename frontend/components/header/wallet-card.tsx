"use client"

import { CreditCard } from "lucide-react"

interface WalletCardProps {
    balance: number
    isLoading?: boolean
    onAddFunds?: () => void
}

export function WalletCard({ balance, isLoading, onAddFunds }: WalletCardProps) {
    if (isLoading) {
        return (
            <div className="relative overflow-hidden rounded-xl p-4 bg-muted/60 animate-pulse">
                <div className="h-12 bg-muted rounded-lg" />
            </div>
        )
    }

    return (
        <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-primary/80 to-primary p-4 shadow-md transition-all duration-200 active:scale-[0.98]">
            {/* Background accent */}
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary-foreground/10 blur-2xl" />
            <div className="absolute -left-8 -bottom-8 h-24 w-24 rounded-full bg-primary-foreground/10 blur-2xl" />

            {/* Content */}
            <div className="relative z-10 flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-xs font-medium text-primary-foreground/80 mb-1 uppercase tracking-wide">
                        Wallet Balance
                    </p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-primary-foreground">
                            {balance.toLocaleString()}
                        </span>
                    </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/20 backdrop-blur-sm">
                    <CreditCard className="h-5 w-5 text-primary-foreground" />
                </div>
            </div>

            {/* Add Funds Button */}
            {onAddFunds && (
                <button
                    onClick={onAddFunds}
                    className="mt-4 w-full rounded-lg bg-primary-foreground/20 px-3 py-2 text-xs font-semibold text-primary-foreground backdrop-blur-sm transition-all duration-200 active:scale-95 hover:bg-primary-foreground/30"
                >
                    Add Funds
                </button>
            )}
        </div>
    )
}
