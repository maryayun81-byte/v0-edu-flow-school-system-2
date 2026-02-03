"use client";

import React from "react"

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  Sparkles,
  User,
  CheckCircle2,
  Copy,
  AtSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function StudentSignup() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [copied, setCopied] = useState(false);

  function generateAdmissionNumber() {
    const year = new Date().getFullYear();
    const seq = Math.floor(Math.random() * 9000) + 1000;
    return `ADM-${year}-${seq.toString().padStart(4, "0")}`;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!fullName.trim()) {
      setError("Full name is required");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    // Validate username format if provided
    if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError("Username must be 3-20 characters and contain only letters, numbers, and underscores");
      setLoading(false);
      return;
    }

    // Check if username is already taken
    if (username) {
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.toLowerCase())
        .single();

      if (existingUser) {
        setError("Username is already taken");
        setLoading(false);
        return;
      }
    }

    try {
      // Generate admission number
      const newAdmissionNumber = generateAdmissionNumber();

      // For students without email, create a placeholder email using admission number
      const authEmail = email.trim() || `${newAdmissionNumber.toLowerCase().replace(/-/g, "")}@student.eduflow.local`;

      // Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "student",
          },
          // Skip email confirmation for placeholder emails
          emailRedirectTo: email.trim() ? `${window.location.origin}/student/login` : undefined,
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          setError("An account with this email already exists");
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      if (authData.user) {
        // Create student profile with admission number and username
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: authData.user.id,
          full_name: fullName,
          username: username ? username.toLowerCase() : null,
          email: email.trim() || null,
          role: "student",
          admission_number: newAdmissionNumber,
          theme: "dark",
          profile_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (profileError) {
          console.error("Profile creation error:", profileError);
          // Don't fail signup if profile creation fails - it can be created later
        }

        setAdmissionNumber(newAdmissionNumber);
        setSuccess(true);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function copyAdmissionNumber() {
    navigator.clipboard.writeText(admissionNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Success State
  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/15 rounded-full blur-[80px] -translate-x-1/3 translate-y-1/3" />
        </div>

        {/* Header */}
        <header className="relative z-10 w-full border-b border-border/50 bg-card/30 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">EduFlow</span>
            </Link>
          </div>
        </header>

        {/* Success Content */}
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-xl text-center">
              {/* Success Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-accent" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to EduFlow!</h1>
              <p className="text-muted-foreground mb-8">Your student account has been created successfully.</p>

              {/* Admission Number Card */}
              <div className="bg-card/60 border border-border/50 rounded-xl p-6 mb-8">
                <p className="text-sm text-muted-foreground mb-2">Your Admission Number</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl font-mono font-bold text-accent">{admissionNumber}</span>
                  <button
                    onClick={copyAdmissionNumber}
                    className="p-2 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors"
                    title="Copy admission number"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-5 h-5 text-accent" />
                    ) : (
                      <Copy className="w-5 h-5 text-accent" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Save this number - you can use it to log in
                </p>
              </div>

              {/* Login Info */}
              <div className="bg-muted/30 border border-border/50 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm font-medium text-foreground mb-2">Your login credentials:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>Admission Number: <span className="text-accent font-mono">{admissionNumber}</span></li>
                  {username && <li>Username: <span className="text-primary font-mono">@{username}</span></li>}
                  <li>Password: <span className="text-muted-foreground">The one you created</span></li>
                </ul>
              </div>

              {/* Next Steps */}
              <div className="space-y-3">
                <Link href="/student/login">
                  <Button className="w-full h-12 bg-accent hover:bg-accent/90 text-foreground font-semibold">
                    Sign In to Dashboard
                  </Button>
                </Link>
                {email && (
                  <p className="text-xs text-muted-foreground">
                    Please check your email to verify your account
                  </p>
                )}
                {!email && (
                  <p className="text-xs text-muted-foreground">
                    You can log in immediately with your admission number
                  </p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-chart-3/20 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/15 rounded-full blur-[80px] -translate-x-1/3 translate-y-1/3" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full border-b border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">EduFlow</span>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-xl">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-chart-3/20 rounded-2xl flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-chart-3" />
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">Create Student Account</h1>
              <p className="text-muted-foreground text-sm">
                Join EduFlow and get your unique admission number
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSignup} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm text-foreground">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-11 h-12 bg-input border-border/50 focus:border-chart-3 focus:ring-chart-3/20"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm text-foreground">
                  Username <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    className="pl-11 h-12 bg-input border-border/50 focus:border-chart-3 focus:ring-chart-3/20"
                    maxLength={20}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Letters, numbers, and underscores only. Can be used to log in.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-foreground">
                  Email Address <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 bg-input border-border/50 focus:border-chart-3 focus:ring-chart-3/20"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  If you have an email, enter it here. Not required for signup.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 pr-11 h-12 bg-input border-border/50 focus:border-chart-3 focus:ring-chart-3/20"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm text-foreground">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-11 h-12 bg-input border-border/50 focus:border-chart-3 focus:ring-chart-3/20"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-chart-3 hover:bg-chart-3/90 text-foreground font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-card text-muted-foreground">Already have an account?</span>
              </div>
            </div>

            {/* Sign In Link */}
            <Link href="/student/login">
              <Button
                variant="outline"
                className="w-full h-12 border-border/50 bg-transparent hover:bg-card/50"
              >
                Sign In
              </Button>
            </Link>
          </div>

          {/* Footer Links */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Teacher or Admin?{" "}
              <Link href="/teacher/signup" className="text-primary hover:underline">
                Create account here
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
