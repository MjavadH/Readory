
"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { UserProfile } from "@/lib/types";
import {
    Settings,
    User,
    Mail,
    Lock,
    Shield,
    Check,
    AlertTriangle,
    Loader2,
    Save,
    KeyRound,
    Eye,
    EyeOff, AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/providers/toast-provider";

function initialsFromUsername(username: string) {
    const safe = (username || "").trim()
    if (!safe) return "U"
    return safe.slice(0, 2).toUpperCase()
}

export default function SettingsPage() {
    const toast = useToast();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form states
    const [username, setUsername] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    useEffect(() => {
        async function fetchProfile() {
            try {
                const res = await apiClient.get<UserProfile>("/auth/profile");
                setProfile(res);
                setUsername(res.username);
            } catch (err: any) {
                setError("Failed to load profile")
            } finally {
                setLoading(false);
            }
        }
        void fetchProfile();
    }, []);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await apiClient.patch("/users/profile", { username });
            toast.success("Profile updated successfully");
        } catch (err: any) {
            toast.error(err.message || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        setSaving(true);
        try {
            await apiClient.patch("/users/profile", {
                username,
                currentPassword,
                newPassword
            });
            toast.success("Password changed successfully");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            toast.error(err.message || "Failed to change password");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-12 pb-24 animate-pulse">
                {/* Header */}
                <section className="px-2">
                    <div className="space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-muted rounded-2xl">
                                <div className="w-8 h-8 bg-muted-foreground/20 rounded-md" />
                            </div>
                            <div className="h-10 w-72 bg-muted rounded-xl" />
                        </div>
                        <div className="h-5 w-96 bg-muted rounded-lg ml-16" />
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Sidebar Profile Card */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-card border border-border rounded-[2rem] p-8 shadow-xl shadow-black/5 space-y-6">
                            <div className="flex flex-col items-center text-center space-y-6">
                                <div className="w-32 h-32 rounded-[2rem] bg-muted" />
                                <div className="space-y-2 w-full flex flex-col items-center">
                                    <div className="h-6 w-40 bg-muted rounded-lg" />
                                    <div className="h-4 w-56 bg-muted rounded-lg" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Forms */}
                    <div className="lg:col-span-8 space-y-10">
                        {/* Profile Form Skeleton */}
                        <section className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl shadow-black/5 space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-muted rounded-2xl">
                                    <div className="w-6 h-6 bg-muted-foreground/20 rounded-md" />
                                </div>
                                <div className="h-6 w-48 bg-muted rounded-lg" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {Array.from({ length: 2 }).map((_, i) => (
                                    <div key={i} className="space-y-3">
                                        <div className="h-4 w-32 bg-muted rounded-lg" />
                                        <div className="h-16 w-full bg-muted rounded-2xl" />
                                        <div className="h-3 w-40 bg-muted rounded-lg" />
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end pt-4">
                                <div className="h-16 w-44 bg-muted rounded-2xl" />
                            </div>
                        </section>

                        {/* Password Form Skeleton */}
                        <section className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl shadow-black/5 space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-muted rounded-2xl">
                                    <div className="w-6 h-6 bg-muted-foreground/20 rounded-md" />
                                </div>
                                <div className="h-6 w-56 bg-muted rounded-lg" />
                            </div>

                            <div className="space-y-6 max-w-md">
                                <div className="space-y-3">
                                    <div className="h-4 w-40 bg-muted rounded-lg" />
                                    <div className="h-16 w-full bg-muted rounded-2xl" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {Array.from({ length: 2 }).map((_, i) => (
                                    <div key={i} className="space-y-3">
                                        <div className="h-4 w-40 bg-muted rounded-lg" />
                                        <div className="h-16 w-full bg-muted rounded-2xl" />
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end pt-4">
                                <div className="h-16 w-52 bg-muted rounded-2xl" />
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center max-w-md mx-auto">
                <div className="p-4 bg-destructive/10 rounded-full">
                    <AlertCircle className="w-12 h-12 text-destructive" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Something went wrong</h2>
                    <p className="text-muted-foreground">{error}</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2.5 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-12 pb-24">
            <section className="px-2">
                <div className="space-y-1">
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl">
                            <Settings className="w-8 h-8 text-primary" />
                        </div>
                        Account Settings
                    </h1>
                    <p className="text-muted-foreground font-medium text-lg ml-16">
                        Manage your personal information and security
                    </p>
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-card border border-border rounded-[2rem] p-8 shadow-xl shadow-black/5 sticky top-28 overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-5">
                            <Shield className="w-24 h-24" />
                        </div>
                        <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                            <div className="w-32 h-32 rounded-[2rem] bg-linear-to-tr from-primary to-primary-foreground/30 flex items-center justify-center border-4 border-background shadow-2xl overflow-hidden ring-8 ring-primary/5">
                                <p className="text-3xl font-bold">
                                    {initialsFromUsername(profile?.username || "")}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold tracking-tight">{profile?.username}</h2>
                                <p className="text-muted-foreground font-medium">{profile?.email}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-8 space-y-10">
                    {/* Profile Form */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl shadow-black/5"
                    >
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-2.5 bg-primary/10 rounded-2xl">
                                <User className="w-6 h-6 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight">Public Profile</h2>
                        </div>

                        <form onSubmit={handleUpdateProfile} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1">Username</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-muted/50 border border-border rounded-2xl focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold"
                                            placeholder="Your unique username"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground font-medium ml-1">This is your public display name.</p>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                        Email Address
                                        <Lock className="w-3 h-3 text-muted-foreground/50" />
                                    </label>
                                    <div className="relative group opacity-60 cursor-not-allowed">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                        <input
                                            type="email"
                                            value={profile?.email}
                                            disabled
                                            className="w-full pl-12 pr-4 py-4 bg-muted border border-border rounded-2xl cursor-not-allowed font-bold"
                                        />
                                    </div>
                                    <p className="text-xs text-amber-600 font-bold flex items-center gap-1 ml-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        Email cannot be changed
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={saving || username === profile?.username}
                                    className="flex items-center gap-2 px-10 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed transition-all text-lg group"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </motion.section>

                    {/* Password Form */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl shadow-black/5"
                    >
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-2.5 bg-primary/10 rounded-2xl">
                                <KeyRound className="w-6 h-6 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight">Security & Password</h2>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-8">
                            <div className="space-y-3 max-w-md">
                                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1">Current Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full pl-12 pr-12 py-4 bg-muted/50 border border-border rounded-2xl focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-muted rounded-xl transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5 text-muted-foreground" /> : <Eye className="w-5 h-5 text-muted-foreground" />}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1">New Password</label>
                                    <div className="relative group">
                                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-muted/50 border border-border rounded-2xl focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold"
                                            placeholder="Min. 8 characters"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1">Confirm New Password</label>
                                    <div className="relative group">
                                        <Check className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-muted/50 border border-border rounded-2xl focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold"
                                            placeholder="Repeat new password"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={saving || !newPassword || newPassword !== confirmPassword}
                                    className="flex items-center gap-2 px-10 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed transition-all text-lg group"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />}
                                    Update Password
                                </button>
                            </div>
                        </form>
                    </motion.section>
                </div>
            </div>
        </div>
    );
}
