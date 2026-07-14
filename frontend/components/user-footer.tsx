"use client"

import Link from "next/link"
import { Github, Send } from "lucide-react"
import { motion, type Variants } from "framer-motion"
import { useTranslations } from "next-intl"
import { BrandLogo } from "@/components/brand-logo"
import {useLocaleInfo} from "@/hooks/use-locale-info";

type FooterCertificate = {
  href: string
  image: string
  alt: string
}

const discoverLinks = [
  { href: "/books", key: "links.books" },
  { href: "/genres", key: "links.genres" },
  { href: "/collections", key: "links.collections" },
  { href: "/books?sort=newest", key: "links.newest" },
  { href: "/books?sort=most_popular", key: "links.popular" },
]

const communityLinks = [
  { href: "/blog", key: "links.blog" },
  { href: "/contact", key: "links.contact" },
]

const accountLinks = [
  { href: "/login", key: "links.login" },
  { href: "/dashboard/library", key: "links.library" },
]

const legalLinks = [
  { href: "/privacy", key: "links.privacy" },
  { href: "/terms", key: "links.terms" },
  { href: "/dmca", key: "links.dmca" },
  { href: "/copyright", key: "links.copyright" },
]

const socialLinks = [
  { href: "https://github.com/MjavadH", icon: Github, label: "GitHub" },
  { href: "https://t.me/", icon: Send, label: "Telegram" },
]

const certificates: FooterCertificate[] = []

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
}

function FooterColumn({
                        title,
                        links,
                        t,
                      }: {
  title: string
  links: { href: string; key: string }[]
  t: ReturnType<typeof useTranslations>
}) {
  return (
      <motion.div variants={item}>
        <h3 className="mb-4 text-sm font-semibold tracking-wide">{title}</h3>
        <ul className="space-y-2.5">
          {links.map((link) => (
              <li key={link.href}>
                <Link
                    href={link.href}
                    className="group relative inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span>{t(link.key)}</span>
                  <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-foreground/60 transition-transform duration-300 ease-out group-hover:scale-x-100 rtl:origin-right" />
                </Link>
              </li>
          ))}
        </ul>
      </motion.div>
  )
}

export function UserFooter() {
  const currentYear = new Date().getFullYear()
  const t = useTranslations("Footer")
  const { isRTL } = useLocaleInfo()

  return (
      <footer dir={isRTL ? "rtl" : "ltr"} className="relative border-t bg-background">
        <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-foreground/20 to-transparent"
        />

        <div className="container mx-auto px-4 py-14">
          <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]"
          >
            <motion.div variants={item} className="col-span-2 sm:col-span-3 lg:col-span-1">
              <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-xl font-bold"
              >
                <BrandLogo height={10} />
                <span>{t("brand")}</span>
              </Link>

              <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                {t("tagline")}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {socialLinks.map((social) => {
                  const Icon = social.icon
                  return (
                      <motion.a
                          key={social.label}
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={social.label}
                          whileHover={{ y: -2, scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          className="flex h-10 w-10 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </motion.a>
                  )
                })}
              </div>
            </motion.div>

            <FooterColumn title={t("sections.discover")} links={discoverLinks} t={t} />
            <FooterColumn title={t("sections.community")} links={communityLinks} t={t} />
            <FooterColumn title={t("sections.account")} links={accountLinks} t={t} />
            <FooterColumn title={t("sections.legal")} links={legalLinks} t={t} />
          </motion.div>

          <div className="my-10 h-px bg-linear-to-r from-transparent via-border to-transparent" />

          <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
          >
            <div>
              <h3 className="mb-4 text-sm font-semibold tracking-wide">
                {t("certificates.title")}
              </h3>

              <div className="flex flex-wrap gap-3">
                {certificates.length > 0 ? (
                    certificates.map((cert) => (
                        <motion.a
                            key={cert.alt}
                            href={cert.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ y: -2, scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            className="flex h-20 w-20 items-center justify-center rounded-xl border bg-muted/20 p-2 transition-colors hover:border-foreground"
                        >
                          <img
                              src={cert.image}
                              alt={cert.alt}
                              className="max-h-full max-w-full object-contain"
                          />
                        </motion.a>
                    ))
                ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">
                      {t("certificates.empty")}
                    </div>
                )}
              </div>
            </div>

            <div className="text-sm text-muted-foreground ltr:lg:text-right rtl:lg:text-left">
              <p>{t("copyright", { year: currentYear })}</p>
              <p className="mt-1">{t("version")}</p>
            </div>
          </motion.div>
        </div>
      </footer>
  )
}
