"use client";

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GraduationCap, Lock, Eye, EyeOff, ArrowLeft, Loader2, Sparkles, Award as IdCard, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const supabase = createClient();

export default function StudentLogin() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(""); // Can be email, username, or admission number
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let authEmail = identifier.trim();
      
      // Check if identifier is an admission number (ADM-YYYY-XXXX format) or username
      const isAdmissionNumber = /^ADM-\d{4}-\d{4}$/i.test(authEmail);
      const isEmail = authEmail.includes("@");
      const isUsername = !isAdmissionNumber && !isEmail;

      if (isAdmissionNumber || isUsername) {
        // Use SECURITY DEFINER RPC function — bypasses RLS safely.
        // The function only returns the email for the given identifier.
        // A direct profiles table query would fail here because the user isn't
        // authenticated yet and RLS blocks anonymous queries.
        const lookupType = isAdmissionNumber ? 'admission_number' : 'username';
        const cleanIdentifier = isUsername && authEmail.startsWith("@") 
          ? authEmail.slice(1) 
          : authEmail;

        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_email_by_identifier', {
            p_identifier: cleanIdentifier,
            p_type: lookupType,
          });

        console.log("RPC lookup:", { cleanIdentifier, lookupType, rpcData, rpcError });

        if (rpcError || !rpcData || rpcData.length === 0) {
          setError(
            isAdmissionNumber
              ? "No account found with this admission number. If you registered with an email, please use that instead."
              : "No account found with this username. Try using your email address instead, or check for typos."
          );
          setLoading(false);
          return;
        }

        authEmail = rpcData[0].email;
        console.log("Resolved auth email:", authEmail);
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("Invalid credentials. Please check your details and try again.");
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      if (authData.user) {
        // Check if user is a student
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, profile_completed, theme")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (profile?.role !== "student") {
          setError("This portal is for students only. Please use the teacher or admin portal.");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        // Apply user's theme preference
        if (profile?.theme) {
          localStorage.setItem("eduflow-theme", profile.theme);
        }

        // Redirect to dashboard (profile modal will show if incomplete)
        router.push("/student/dashboard");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setLoading(false);
    }
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
              <h1 className="text-2xl font-bold text-foreground mb-2">Student Portal</h1>
              <p className="text-muted-foreground text-sm">Sign in with your admission number, username, or email</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-sm text-foreground">Admission Number, Username, or Email</Label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="ADM-2024-0001, @username, or email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="pl-11 h-12 bg-input border-border/50 focus:border-chart-3 focus:ring-chart-3/20"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter your admission number (ADM-XXXX-XXXX), username, or email
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-foreground">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 pr-11 h-12 bg-input border-border/50 focus:border-chart-3 focus:ring-chart-3/20"
                    required
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

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-chart-3 hover:bg-chart-3/90 text-foreground font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-card text-muted-foreground">New to EduFlow?</span>
              </div>
            </div>

            {/* Sign Up Link */}
            <Link href="/student/signup">
              <Button variant="outline" className="w-full h-12 border-border/50 bg-transparent hover:bg-card/50">
                Create Student Account
              </Button>
            </Link>
          </div>

          {/* Footer Links */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Teacher or Admin?{" "}
              <Link href="/teacher/login" className="text-primary hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
