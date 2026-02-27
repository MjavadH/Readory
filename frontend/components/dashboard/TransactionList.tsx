"use client";

import { Transaction } from "@/lib/types";
import { ArrowDownLeft, ArrowUpRight, Clock, Hash } from "lucide-react";
import { formatUpdateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Props {
    transactions: Transaction[];
    limit?: number;
    className?: string;
}

export function TransactionList({ transactions, limit, className }: Props) {
    const displayTx = limit ? transactions.slice(0, limit) : transactions;

    return (
        <div className={cn("space-y-4", className)}>
            {displayTx.map((tx, idx) => (
                <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group flex flex-wrap items-center gap-3 justify-between p-4 bg-muted/40 hover:bg-muted/80 border border-border/50 rounded-2xl transition-all hover:scale-[1.01] active:scale-100 hover:shadow-lg shadow-black/5"
                >
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "p-3 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500 shadow-md",
                            tx.type === 'CREDIT'
                                ? "bg-green-500/10 text-green-600 border border-green-500/20"
                                : "bg-red-500/10 text-red-600 border border-red-500/20"
                        )}>
                            {tx.type === 'CREDIT'
                                ? <ArrowDownLeft className="w-5 h-5 drop-shadow-sm" />
                                : <ArrowUpRight className="w-5 h-5 drop-shadow-sm" />
                            }
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
                                {tx.type === 'CREDIT' ? 'Deposit' : 'Purchase'}
                            </span>
                            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                                <div className="flex items-center gap-1 bg-background/50 px-2 py-0.5 rounded-lg border border-border/50">
                                    <Hash className="w-3 h-3" />
                                    <span>{tx.reference || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-1 bg-background/50 px-2 py-0.5 rounded-lg border border-border/50">
                                    <Clock className="w-3 h-3" />
                                    <span>{formatUpdateTime(new Date(tx.createdAt))}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={cn(
                        "text-lg font-bold tracking-tight px-4 py-2 rounded-2xl bg-background/40 border border-border/40",
                        tx.type === 'CREDIT' ? "text-green-600" : "text-red-600"
                    )}>
                        {tx.type === 'CREDIT' ? '+' : '-'}${tx.amount.toFixed(2)}
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
