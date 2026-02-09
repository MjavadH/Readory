"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BookOpen, Loader2, ArrowLeft, Mail, Lock, User } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { apiClient, getApiErrorMessage } from "@/lib/api-client"

const authSchema = z.object({
  email: z.string().min(1, { message: "Email or Username is required" }),
  username: z.string().optional(),

  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
}).refine((data) => {
  return true;
});

const otpSchema = z.object({
  otp: z.string().length(6, { message: "OTP must be 6 digits" }),
})

type AuthFormValues = z.infer<typeof authSchema>
type OTPFormValues = z.infer<typeof otpSchema>

type ViewMode = "login" | "register" | "otp"

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<ViewMode>("login")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState("")

  const authForm = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      username: "",
      password: "",
    },
  })

  const otpForm = useForm<OTPFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: "",
    },
  })

  // Handle Login
  const handleLogin = async (values: AuthFormValues) => {
    setIsLoading(true)
    setError("")

    try {
      const payload = {
        identifier: values.email,
        password: values.password
      }

      const data = await apiClient.post<{ user?: { roleName?: string } }>("/auth/login", payload)

      const roleName = data.user?.roleName;
      if (roleName === "ADMIN") {
        router.push("/admin")
      } else {
        router.push("/dashboard")
      }
    } catch (error) {
      setError(getApiErrorMessage(error, "An error occurred during login. Please try again."))
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Register
  const handleRegister = async (values: AuthFormValues) => {
    if (!values.username || values.username.length < 3) {
      authForm.setError("username", { message: "Username must be at least 3 chars" })
      return
    }

    setIsLoading(true)
    setError("")

    try {
      await apiClient.post("/auth/register", {
        email: values.email,
        username: values.username,
        password: values.password
      })

      setRegisteredEmail(values.email)
      setMode("otp")
      authForm.reset()
    } catch (error) {
      setError(getApiErrorMessage(error, "An error occurred during registration. Please try again."))
    } finally {
      setIsLoading(false)
    }
  }

  // Handle OTP Verify
  const handleOTPVerify = async (values: OTPFormValues) => {
    setIsLoading(true)
    setError("")

    try {
      await apiClient.post("/auth/verify-otp", {
        email: registeredEmail,
        otp: values.otp,
      })

      alert("Account verified! Please login.");
      setMode("login");
    } catch (error) {
      setError(getApiErrorMessage(error, "An error occurred during verification. Please try again."))
    } finally {
      setIsLoading(false)
    }
  }

  return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
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
              <CardDescription>
                {mode === "otp" && `Enter the code sent to ${registeredEmail}`}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
              )}

              {(mode === "login" || mode === "register") && (
                  <Form {...authForm}>
                    <form
                        onSubmit={authForm.handleSubmit(mode === "login" ? handleLogin : handleRegister)}
                        className="space-y-4"
                    >
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
                                        <Input
                                            placeholder="Choose a username"
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
                                    <Input
                                        placeholder="Enter password"
                                        type="password"
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
                                    <InputOTP maxLength={6} {...field}>
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
                              setError("")
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
                          setError("")
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
