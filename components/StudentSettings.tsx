"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Settings,
  User,
  Palette,
  Bell,
  Shield,
  Loader2,
  CheckCircle2,
  Camera,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import ThemeSelector from "@/components/ThemeSelector";
import { useTheme, type ThemeType } from "@/contexts/ThemeContext";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StudentSettingsProps {
  profile: {
    id: string;
    full_name: string;
    username?: string;
    email?: string;
    avatar_url?: string;
    theme?: string;
    school_name?: string;
    form_class?: string;
  };
  onClose?: () => void;
  onProfileUpdate: () => void;
}

export default function StudentSettings({
  profile,
  onProfileUpdate,
}: StudentSettingsProps) {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"profile" | "theme" | "notifications">("profile");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Profile fields
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [username, setUsername] = useState(profile.username || "");

  const handleThemeChange = async (newTheme: ThemeType) => {
    setTheme(newTheme);
    
    // Save to database
    await supabase
      .from("profiles")
      .update({ theme: newTheme, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setError("");
    setSuccess(false);

    // Validate username
    if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError("Username must be 3-20 characters with only letters, numbers, and underscores");
      setLoading(false);
      return;
    }

    // Check if username is taken
    if (username && username !== profile.username) {
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.toLowerCase())
        .neq("id", profile.id)
        .single();

      if (existingUser) {
        setError("Username is already taken");
        setLoading(false);
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        username: username ? username.toLowerCase() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      onProfileUpdate();
      setTimeout(() => setSuccess(false), 3000);
    }

    setLoading(false);
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "theme", label: "Appearance", icon: Palette },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-card/80 border-b border-border/50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Settings</h2>
              <p className="text-sm text-muted-foreground">Customize your experience</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50 bg-card/40">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-xl flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              <p className="text-sm text-accent">Changes saved successfully!</p>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm text-foreground">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-11 bg-input border-border/50"
                    placeholder="Your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm text-foreground">
                    Username
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      className="h-11 bg-input border-border/50 pl-8"
                      placeholder="Choose a username"
                      maxLength={20}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used for logging in. Letters, numbers, and underscores only.
                  </p>
                </div>

                {/* Read-only fields */}
                <div className="pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-3">Account Information</p>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">School</span>
                      <span className="text-sm text-foreground">{profile.school_name || "Not set"}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">Class</span>
                      <span className="text-sm text-foreground">{profile.form_class || "Not set"}</span>
                    </div>
                    {profile.email && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-muted-foreground">Email</span>
                        <span className="text-sm text-foreground">{profile.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={loading}
                className="w-full h-11 bg-primary hover:bg-primary/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          )}

          {/* Theme Tab */}
          {activeTab === "theme" && (
            <ThemeSelector variant="inline" onThemeChange={handleThemeChange} />
          )}
        </div>
      </div>
    </div>
  );
}
