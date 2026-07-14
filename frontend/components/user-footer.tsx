"use client"

import Link from "next/link"
import { Github, Send } from "lucide-react"
import { motion, type Variants } from "framer-motion"
import { BrandLogo } from "@/components/brand-logo"
import { useTranslations } from "next-intl"
import {useLocaleInfo} from "@/hooks/use-locale-info";

type FooterCertificate = {
  href: string
  image: string
  alt: string
}

const discoverLinks = [
  { href: "/books", label: "Books" },
  { href: "/genres", label: "Genres" },
  { href: "/collections", label: "Collections" },
  { href: "/books?sort=newest", label: "Newest Books" },
  { href: "/books?sort=most_popular", label: "Popular Books" },
]

const communityLinks = [
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact Us" },
]

const accountLinks = [
  { href: "/login", label: "Login" },
  { href: "/dashboard/library", label: "My Library" },
]

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/dmca", label: "DMCA" },
  { href: "/copyright", label: "Copyright" },
]

const socialLinks = [
  { href: "https://github.com/MjavadH", icon: Github, label: "GitHub" },
  { href: "https://t.me/", icon: Send, label: "Telegram" },
]

const certificates: FooterCertificate[] = []

// ---------- Motion presets ----------
const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
}

// ---------- Column ----------
function FooterColumn({
                        title,
                        links,
                      }: {
  title: string
  links: { href: string; label: string }[]
}) {
  return (
      <motion.div variants={item}>
        <h3 className="mb-4 text-sm font-semibold tracking-wide text-foreground">
          {title}
        </h3>

        <ul className="space-y-2.5">
          {links.map((link) => (
              <li key={link.href}>
                <Link
                    href={link.href}
                    className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
              <span className="relative">
                {link.label}
                <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-foreground/60 transition-transform duration-300 ease-out group-hover:scale-x-100 rtl:origin-right" />
              </span>
                </Link>
              </li>
          ))}
        </ul>
      </motion.div>
  )
}

export function UserFooter() {
  const currentYear = new Date().getFullYear()
  const g = useTranslations("General")
  const { isRTL } = useLocaleInfo()

  return (
      <footer
          dir={isRTL ? "rtl" : "ltr"}
          className="relative border-t border-border/60 bg-background"
      >
        {/* subtle top accent */}
        <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-foreground/15 to-transparent"
        />

        <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="container mx-auto px-4 py-12 sm:px-6 sm:py-14 lg:py-16"
        >
          {/* Top grid */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] lg:gap-10">
            {/* Brand block */}
            <motion.div
                variants={item}
                className="col-span-2 sm:col-span-3 lg:col-span-1"
            >
              <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-xl font-bold text-foreground transition-opacity hover:opacity-80"
              >
                <BrandLogo height={10} />
                <span>{g("Readory")}</span>
              </Link>

              <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                Discover, read and organize your favorite books in one place.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {socialLinks.map(({ href, icon: Icon, label }) => (
                    <motion.a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.94 }}
                        transition={{ type: "spring", stiffness: 350, damping: 20 }}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors duration-200 hover:border-foreground/60 hover:bg-foreground/5 hover:text-foreground"
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </motion.a>
                ))}
              </div>
            </motion.div>

            <FooterColumn title="Discover" links={discoverLinks} />
            <FooterColumn title="Community" links={communityLinks} />
            <FooterColumn title="Account" links={accountLinks} />
            <FooterColumn title="Legal" links={legalLinks} />
          </div>

          {/* Divider */}
          <motion.div
              variants={item}
              className="my-10 h-px bg-linear-to-r from-transparent via-border to-transparent"
          />

          {/* Bottom */}
          <motion.div
              variants={item}
              className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
          >
            <div>
              <h3 className="mb-4 text-sm font-semibold tracking-wide">
                Trust & Certificates
              </h3>

              <div className="flex flex-wrap gap-3">
                {certificates.length > 0 ? (
                    certificates.map((c) => (
                        <motion.a
                            key={c.alt}
                            href={c.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ y: -2 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="flex h-20 w-20 items-center justify-center rounded-xl border border-border/70 bg-muted/30 p-2 transition-colors hover:border-foreground/50"
                        >
                          <img
                              src={c.image}
                              alt={c.alt}
                              className="max-h-full max-w-full object-contain"
                          />
                        </motion.a>
                    ))
                ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                      No Logo
                    </div>
                )}
              </div>
            </div>

            <div className="text-sm text-muted-foreground ltr:lg:text-right rtl:lg:text-left">
              <p>{g("Copyright", { Year: currentYear })}</p>
              <p className="mt-1 text-xs opacity-80">{g("Version")}</p>
            </div>
          </motion.div>
        </motion.div>
      </footer>
  )
}
