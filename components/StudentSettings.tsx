"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Settings,
  User,
  Palette,
  BookOpen,
  Loader2,
  CheckCircle2,
  Camera,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeSelector from "@/components/ThemeSelector";
import { useTheme, type ThemeType } from "@/contexts/ThemeContext";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const AVAILABLE_SUBJECTS = [
  "Mathematics",
  "English",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "Computer Science",
  "Business Studies",
  "Economics",
  "Art",
  "Music",
  "Physical Education",
];

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
    subjects?: string[];
  };
  onClose?: () => void;
  onProfileUpdate: () => void;
}

export default function StudentSettings({
  profile,
  onProfileUpdate,
}: StudentSettingsProps) {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"profile" | "subjects" | "theme">("profile");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Profile fields
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [username, setUsername] = useState(profile.username || "");
  
  // Subjects
  const [registeredSubjects, setRegisteredSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");

  useEffect(() => {
    fetchRegisteredSubjects();
  }, [profile.id]);

  async function fetchRegisteredSubjects() {
    const { data } = await supabase
      .from("student_subjects")
      .select("subject_name")
      .eq("student_id", profile.id);

    if (data && data.length > 0) {
      setRegisteredSubjects(data.map(s => s.subject_name));
    } else if (profile.subjects && profile.subjects.length > 0) {
      // Fallback/Migration: If table is empty but profile has subjects, migrate them
      console.log("Migrating subjects from profile to table...");
      const subjectsToInsert = profile.subjects.map(s => ({
        student_id: profile.id,
        subject_name: s
      }));
      
      await supabase.from("student_subjects").upsert(subjectsToInsert, { onConflict: 'student_id,subject_name' });
      setRegisteredSubjects(profile.subjects);
    }
  }

  async function handleAddSubject() {
    if (!selectedSubject || registeredSubjects.includes(selectedSubject)) {
      setError("Please select a subject you haven't registered yet");
      return;
    }

    setLoading(true);
    setError("");

    const { error: insertError } = await supabase
      .from("student_subjects")
      .insert({
        student_id: profile.id,
        subject_name: selectedSubject,
      });

    if (insertError) {
      setError(insertError.message);
    } else {
      // Sync with profiles table for dashboard compatibility
      const newSubjects = [...registeredSubjects, selectedSubject];
      await supabase
        .from("profiles")
        .update({ subjects: newSubjects, updated_at: new Date().toISOString() })
        .eq("id", profile.id);

      setRegisteredSubjects(newSubjects);
      setSelectedSubject("");
      onProfileUpdate(); // Refresh parent dashboard
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }

    setLoading(false);
  }

  async function handleRemoveSubject(subjectName: string) {
    setLoading(true);
    setError("");

    const { error: deleteError } = await supabase
      .from("student_subjects")
      .delete()
      .eq("student_id", profile.id)
      .eq("subject_name", subjectName);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      // Sync with profiles table for dashboard compatibility
      const newSubjects = registeredSubjects.filter(s => s !== subjectName);
      await supabase
        .from("profiles")
        .update({ subjects: newSubjects, updated_at: new Date().toISOString() })
        .eq("id", profile.id);

      setRegisteredSubjects(newSubjects);
      onProfileUpdate(); // Refresh parent dashboard
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }

    setLoading(false);
  }

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to avatars bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // If bucket doesn't exist, show helpful error
        if (uploadError.message.includes('not found')) {
          setError('Avatar storage not set up. Please contact admin to create the "avatars" bucket.');
        } else {
          setError(uploadError.message);
        }
        setLoading(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (updateError) {
        setError(updateError.message);
      } else {
        onProfileUpdate();
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to upload avatar');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "subjects", label: "Subjects", icon: BookOpen },
    { id: "theme", label: "Appearance", icon: Palette },
  ];

  return (
    <div className="w-full max-w-full sm:max-w-3xl mx-auto px-2 sm:px-0">
      <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-card/80 border-b border-border/50 px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">Settings</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Customize your experience</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50 bg-card/40 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-h-[calc(100vh-300px)] sm:max-h-[600px]">
          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
              <p className="text-xs sm:text-sm text-destructive text-center">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-accent/10 border border-accent/30 rounded-xl flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-accent" />
              <p className="text-xs sm:text-sm text-accent">Changes saved successfully!</p>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-foreground">
                    Profile Image
                  </Label>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden border-2 border-border/50">
                      {profile.avatar_url ? (
                        <img 
                          src={profile.avatar_url} 
                          alt="Avatar" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-8 h-8 text-accent" />
                      )}
                    </div>
                    <div className="text-center sm:text-left">
                      <input
                        type="file"
                        id="avatar-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={loading}
                      />
                      <Label
                        htmlFor="avatar-upload"
                        className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        Change Photo
                      </Label>
                      <p className="text-xs text-muted-foreground mt-2">
                        JPG, PNG or GIF (max 5MB)
                      </p>
                    </div>
                  </div>
                </div>

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
                        <span className="text-sm text-foreground truncate max-w-[200px]">{profile.email}</span>
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

          {/* Subjects Tab */}
          {activeTab === "subjects" && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">Registered Subjects</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                  Manage the subjects you're enrolled in
                </p>
              </div>

              {/* Add Subject */}
              <div className="space-y-2">
                <Label className="text-sm text-foreground">Add New Subject</Label>
                <div className="flex gap-2">
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="flex-1 h-11 px-3 rounded-lg bg-input border border-border/50 text-foreground text-sm"
                    disabled={loading}
                  >
                    <option value="">Select a subject...</option>
                    {AVAILABLE_SUBJECTS.filter(s => !registeredSubjects.includes(s)).map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                  <Button
                    onClick={handleAddSubject}
                    disabled={!selectedSubject || loading}
                    className="h-11 px-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              {/* Registered Subjects List */}
              <div className="space-y-2">
                <Label className="text-sm text-foreground">Your Subjects ({registeredSubjects.length})</Label>
                {registeredSubjects.length === 0 ? (
                  <div className="text-center py-8 bg-muted/30 rounded-xl border border-border/30">
                    <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">No subjects registered yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {registeredSubjects.map(subject => (
                      <div
                        key={subject}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/30"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">{subject}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveSubject(subject)}
                          disabled={loading}
                          className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
