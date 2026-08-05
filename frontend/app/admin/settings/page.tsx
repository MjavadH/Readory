'use client';

import { motion } from 'framer-motion';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20 pb-20 sm:pb-0">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
        <motion.div
          className="space-y-1 p-3 md:p-0"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55 }}
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Configure system preferences</p>
        </motion.div>
      </div>
    </div>
  );
}
