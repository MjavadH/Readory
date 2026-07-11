"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Receipt } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useTranslations } from "next-intl"
import {useLocaleInfo} from "@/hooks/use-locale-info";

type PaymentResultData = {
    success: boolean
    invoiceId?: number
    refId?: string
}

export default function PaymentResultPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get("token")
    const t = useTranslations("Payment")
    const { isRTL } = useLocaleInfo()

    const [loading, setLoading] = useState(true)
    const [result, setResult] = useState<PaymentResultData | null>(null)

    useEffect(() => {
        if (!token) {
            router.replace("/")
            return
        }

        const fetchResult = async () => {
            try {
                const data = await apiClient.get<PaymentResultData>(
                    `/wallet/payment/result/${token}`,
                )
                setResult(data)
            } catch {
                router.replace("/")
            } finally {
                setLoading(false)
            }
        }

        fetchResult()
    }, [token, router])

    if (loading) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="size-10 animate-spin text-blue-600 dark:text-blue-400" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t("Loading")}
                    </p>
                </div>
            </div>
        )
    }

    if (!result) return null

    const success = result.success

    return (
        <div
            dir={isRTL ? "rtl" : "ltr"}
            className="flex min-h-dvh items-center justify-center bg-linear-to-b from-slate-50 to-slate-100 px-4 py-8 dark:from-slate-950 dark:to-slate-900 sm:px-6"
        >
            <div className="w-full max-w-md">
                {/* Status header card */}
                <div className="relative overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-800">
                    {/* Colored top band */}
                    <div
                        className={`h-2 w-full ${
                            success
                                ? "bg-linear-to-r from-emerald-400 to-emerald-600"
                                : "bg-linear-to-r from-rose-400 to-rose-600"
                        }`}
                    />

                    <div className="px-6 pb-6 pt-8 text-center sm:px-8 sm:pt-10">
                        {/* Icon */}
                        <div
                            className={`mx-auto mb-5 flex size-20 items-center justify-center rounded-full ring-8 ${
                                success
                                    ? "bg-emerald-50 text-emerald-600 ring-emerald-50/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/5"
                                    : "bg-rose-50 text-rose-600 ring-rose-50/60 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/5"
                            }`}
                        >
                            {success ? (
                                <CheckCircle2 className="size-12" strokeWidth={2} />
                            ) : (
                                <XCircle className="size-12" strokeWidth={2} />
                            )}
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                            {success ? t("Success") : t("Failure")}
                        </h1>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            {success ? t("SuccessDescription") : t("FailureDescription")}
                        </p>

                        {/* Details */}
                        {success && result.refId && (
                            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-start dark:border-slate-800 dark:bg-slate-800/50">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        <Receipt className="size-4" />
                                        <span>{t("Ref")}</span>
                                    </div>
                                    <span
                                        dir="ltr"
                                        className="truncate font-mono text-sm font-semibold text-slate-900 dark:text-slate-100"
                                    >
                                        {result.refId}
                                    </span>
                                </div>
                                {result.invoiceId !== undefined && (
                                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {t("Invoice")}
                                        </span>
                                        <span
                                            dir="ltr"
                                            className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100"
                                        >
                                            #{result.invoiceId}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="mt-6 flex flex-col gap-2">
                            <button
                                onClick={() => router.replace("/")}
                                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-4 ${
                                    success
                                        ? "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/30"
                                        : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/30"
                                }`}
                            >
                                <ArrowLeft
                                    className={`size-4 ${isRTL ? "rotate-180" : ""}`}
                                />
                                {t("Back")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
