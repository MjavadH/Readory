"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BookOpen, Loader2, ArrowLeft, Mail, Lock, User } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { apiClient, getApiErrorMessage } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import {BrandLogo} from "@/components/brand-logo";

type RoleName = "ADMIN" | "USER"

type ProfileResponse = {
  roleName?: RoleName
}

const authSchema = z.object({
  email: z.string().min(1, { message: "Email or Username is required" }),
  username: z.string().optional(),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
})

const otpSchema = z.object({
  otp: z.string().length(6, { message: "OTP must be 6 digits" }).regex(/^\d{6}$/, { message: "OTP must be numeric" }),
})

type AuthFormValues = z.infer<typeof authSchema>
type OTPFormValues = z.infer<typeof otpSchema>
type ViewMode = "login" | "register" | "otp"

export default function AuthPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [mode, setMode] = useState<ViewMode>("login")
  const [isLoading, setIsLoading] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState("")
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  const authForm = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", username: "", password: "" },
  })

  const otpForm = useForm<OTPFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  })

  useEffect(() => {
    const checkSession = async () => {
      try {
        const profile = await apiClient.get<ProfileResponse>("/auth/profile")
        router.replace(profile.roleName === "ADMIN" ? "/admin" : "/")
      } catch {
        setIsCheckingSession(false)
      }
    }
    void checkSession()
  }, [router])

  const handleLogin = async (values: AuthFormValues) => {
    setIsLoading(true)
    try {
      const data = await apiClient.post<{ user?: { roleName?: RoleName } }>("/auth/login", {
        identifier: values.email.trim(),
        password: values.password,
      })

      router.push(data.user?.roleName === "ADMIN" ? "/admin" : "/")
    } catch (error) {
      toast({
        title: "Login failed",
        description: getApiErrorMessage(error, "An error occurred during login."),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (values: AuthFormValues) => {
    if (!values.username || values.username.length < 3) {
      authForm.setError("username", { message: "Username must be at least 3 chars" })
      return
    }

    setIsLoading(true)
    try {
      await apiClient.post("/auth/register", {
        email: values.email.trim(),
        username: values.username.trim(),
        password: values.password,
      })

      setRegisteredEmail(values.email.trim())
      setMode("otp")
      authForm.reset()
      toast({ title: "Verification sent", description: "Enter the 6-digit OTP code sent to your email." })
    } catch (error) {
      toast({
        title: "Registration failed",
        description: getApiErrorMessage(error, "An error occurred during registration."),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOTPVerify = async (values: OTPFormValues) => {
    if (isLoading) return
    setIsLoading(true)

    try {
      const data = await apiClient.post<{ user?: { roleName?: RoleName } }>("/auth/verify-otp", {
        email: registeredEmail,
        otp: values.otp,
      })

      toast({ title: "Verified", description: "Your account is now active and signed in." })
      router.push(data.user?.roleName === "ADMIN" ? "/admin" : "/")
    } catch (error) {
      toast({
        title: "Verification failed",
        description: getApiErrorMessage(error, "An error occurred during verification."),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-muted/20 to-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center">
            <BrandLogo priority className="h-20 w-20" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Readory</h1>
          <p className="text-muted-foreground mt-2">
            {mode === "login" && "Sign in with Email or Username"}
            {mode === "register" && "Create an account to get started"}
            {mode === "otp" && "Verify your email address"}
          </p>
        </div>

        <Card className="border-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">
              {mode === "login" && "Sign In"}
              {mode === "register" && "Create Account"}
              {mode === "otp" && "Email Verification"}
            </CardTitle>
            <CardDescription>{mode === "otp" && `Enter the code sent to ${registeredEmail}`}</CardDescription>
          </CardHeader>

          <CardContent>
            {(mode === "login" || mode === "register") && (
              <Form {...authForm}>
                <form onSubmit={authForm.handleSubmit(mode === "login" ? handleLogin : handleRegister)} className="space-y-4">
                  {mode === "register" && (
                    <FormField
                      control={authForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="username" disabled={isLoading} className="pl-10" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={authForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{mode === "login" ? "Email or Username" : "Email Address"}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder={mode === "login" ? "email or username" : "name@gmail.com"}
                              disabled={isLoading}
                              className="pl-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={authForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Enter password" type="password" disabled={isLoading} className="pl-10" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>{mode === "login" ? "Sign In" : "Create Account"}</>
                    )}
                  </Button>
                </form>
              </Form>
            )}

            {mode === "otp" && (
              <Form {...otpForm}>
                <form onSubmit={otpForm.handleSubmit(handleOTPVerify)} className="space-y-6">
                  <FormField
                    control={otpForm.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Code</FormLabel>
                        <FormControl>
                          <div className="flex justify-center">
                            <InputOTP
                              maxLength={6}
                              {...field}
                              onComplete={() => otpForm.handleSubmit(handleOTPVerify)()}
                            >
                              <InputOTPGroup>
                                <InputOTPSlot index={0} />
                                <InputOTPSlot index={1} />
                                <InputOTPSlot index={2} />
                                <InputOTPSlot index={3} />
                                <InputOTPSlot index={4} />
                                <InputOTPSlot index={5} />
                              </InputOTPGroup>
                            </InputOTP>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                      {isLoading ? "Verifying..." : "Verify & Activate"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setMode("register")
                        otpForm.reset()
                      }}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Register
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {(mode === "login" || mode === "register") && (
              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">
                  {mode === "login" ? "Don't have an account?" : "Already have an account?"}
                </span>{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "login" ? "register" : "login")
                    authForm.reset()
                  }}
                  className="text-primary hover:underline font-medium"
                  disabled={isLoading}
                >
                  {mode === "login" ? "Sign Up" : "Sign In"}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
