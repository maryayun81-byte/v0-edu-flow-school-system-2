"use client";

import React from "react"

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  Mail,
  Phone,
  BookOpen,
  Save,
  Loader2,
  CheckCircle,
  Camera,
  X,
} from "lucide-react";

interface TeacherProfileProps {
  userId: string;
  onClose: () => void;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  subject: string;
  bio: string;
  avatar_url: string;
}

export default function TeacherProfile({ userId, onClose }: TeacherProfileProps) {
  const [profile, setProfile] = useState<Profile>({
    id: userId,
    full_name: "",
    email: "",
    phone: "",
    subject: "",
    bio: "",
    avatar_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      // Get user email from auth
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      setProfile({
        id: userId,
        full_name: data?.full_name || "",
        email: user?.email || "",
        phone: data?.phone || "",
        subject: data?.subject || "",
        bio: data?.bio || "",
        avatar_url: data?.avatar_url || "",
      });
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      // Try upsert to handle both insert and update
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          full_name: profile.full_name,
          phone: profile.phone,
          subject: profile.subject,
          bio: profile.bio,
          avatar_url: profile.avatar_url,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-avatar.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("documents").getPublicUrl(filePath);
      
      setProfile({ ...profile, avatar_url: data.publicUrl });
    } catch (err) {
      console.error("Error uploading avatar:", err);
      setError("Failed to upload avatar");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">My Profile</h2>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Avatar Section */}
      <div className="flex items-center gap-6 mb-8 pb-8 border-b border-white/10">
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url || "/placeholder.svg"}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-12 h-12 text-white" />
            )}
          </div>
          <label className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer transition-colors">
            <Camera className="w-4 h-4 text-white" />
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </label>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white">
            {profile.full_name || "Set your name"}
          </h3>
          <p className="text-gray-400">{profile.email}</p>
          {profile.subject && (
            <span className="inline-block mt-2 px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-sm">
              {profile.subject}
            </span>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center gap-2">
              <User className="w-4 h-4" />
              Full Name
            </Label>
            <Input
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="Enter your full name"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </Label>
            <Input
              value={profile.email}
              disabled
              className="bg-white/5 border-white/10 text-gray-400 cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone Number
            </Label>
            <Input
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="Enter your phone number"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Subject
            </Label>
            <Input
              value={profile.subject}
              onChange={(e) => setProfile({ ...profile, subject: e.target.value })}
              placeholder="e.g., Mathematics, Physics"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300">Bio</Label>
          <Textarea
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            placeholder="Tell students about yourself..."
            rows={4}
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-indigo-500 resize-none"
          />
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {saved && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Profile saved successfully!
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-transparent border-white/20 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
