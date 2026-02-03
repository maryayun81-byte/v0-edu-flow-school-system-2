"use client";

import React from "react"

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  GraduationCap,
  School,
  BookOpen,
  Loader2,
  CheckCircle2,
  X,
  Palette,
  Sun,
  Moon,
  Flower2,
  Waves,
  Leaf,
  Sparkles,
  Sunrise,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useTheme, THEMES, type ThemeType } from "@/contexts/ThemeContext";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StudentProfileModalProps {
  userId: string;
  onComplete: () => void;
}

const FORM_LEVELS = ["Form 1", "Form 2", "Form 3", "Form 4"];

const AVAILABLE_SUBJECTS = [
  { id: "math", name: "Mathematics", isCore: true },
  { id: "eng", name: "English", isCore: true },
  { id: "kis", name: "Kiswahili", isCore: true },
  { id: "phy", name: "Physics", isCore: false },
  { id: "chem", name: "Chemistry", isCore: false },
  { id: "bio", name: "Biology", isCore: false },
  { id: "hist", name: "History", isCore: false },
  { id: "geo", name: "Geography", isCore: false },
  { id: "cs", name: "Computer Studies", isCore: false },
  { id: "bus", name: "Business Studies", isCore: false },
  { id: "agri", name: "Agriculture", isCore: false },
  { id: "re", name: "Religious Education", isCore: false },
];

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  sun: Sun,
  moon: Moon,
  flower: Flower2,
  waves: Waves,
  leaf: Leaf,
  sparkles: Sparkles,
  sunrise: Sunrise,
};

export default function StudentProfileModal({
  userId,
  onComplete,
}: StudentProfileModalProps) {
  const { theme, setTheme } = useTheme();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [schoolName, setSchoolName] = useState("");
  const [formClass, setFormClass] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([
    "math",
    "eng",
    "kis",
  ]);
  const [selectedTheme, setSelectedTheme] = useState<ThemeType>(theme);

  const totalSteps = 4;

  function toggleSubject(subjectId: string) {
    const subject = AVAILABLE_SUBJECTS.find((s) => s.id === subjectId);
    if (subject?.isCore) return; // Cannot deselect core subjects

    setSelectedSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  }

  async function handleSubmit() {
    if (!schoolName || !formClass || selectedSubjects.length < 3) {
      setError("Please complete all required fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const subjectNames = selectedSubjects.map(
        (id) => AVAILABLE_SUBJECTS.find((s) => s.id === id)?.name
      );

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          school_name: schoolName,
          form_class: formClass,
          subjects: subjectNames,
          theme: selectedTheme,
          profile_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Apply the selected theme
      setTheme(selectedTheme);
      
      onComplete();
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-card/80 border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-chart-3/20 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-chart-3" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Complete Your Profile</h2>
              <p className="text-sm text-muted-foreground">
                Step {step} of {totalSteps}
              </p>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="mt-4 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-chart-3 rounded-full transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          )}

          {/* Step 1: School Name */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <School className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  What school do you attend?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Enter your school name to connect with your classmates
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schoolName" className="text-sm text-foreground">
                  School Name
                </Label>
                <Input
                  id="schoolName"
                  placeholder="e.g., Nairobi Academy"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="h-12 bg-input border-border/50 focus:border-primary focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          {/* Step 2: Form/Class Level */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <GraduationCap className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  What form are you in?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select your current form or class level
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {FORM_LEVELS.map((form) => (
                  <button
                    key={form}
                    onClick={() => setFormClass(form)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formClass === form
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-border/50 bg-card/50 text-muted-foreground hover:border-border hover:bg-card"
                    }`}
                  >
                    <span className="font-semibold">{form}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Subject Selection */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-chart-3/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-chart-3" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Select your subjects
                </h3>
                <p className="text-sm text-muted-foreground">
                  Core subjects are pre-selected. Choose your electives.
                </p>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {AVAILABLE_SUBJECTS.map((subject) => (
                  <div
                    key={subject.id}
                    onClick={() => toggleSubject(subject.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedSubjects.includes(subject.id)
                        ? "border-chart-3/50 bg-chart-3/10"
                        : "border-border/50 bg-card/30 hover:bg-card/50"
                    } ${subject.isCore ? "cursor-not-allowed" : ""}`}
                  >
                    <Checkbox
                      checked={selectedSubjects.includes(subject.id)}
                      disabled={subject.isCore}
                      className="data-[state=checked]:bg-chart-3 data-[state=checked]:border-chart-3"
                    />
                    <span className="flex-1 text-sm font-medium text-foreground">
                      {subject.name}
                    </span>
                    {subject.isCore && (
                      <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">
                        Core
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {selectedSubjects.length} subjects selected
              </p>
            </div>
          )}

          {/* Step 4: Theme Selection */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Palette className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Choose your theme
                </h3>
                <p className="text-sm text-muted-foreground">
                  Pick an appearance that suits your style
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-2">
                {THEMES.map((t) => {
                  const Icon = iconMap[t.icon] || Sun;
                  const isSelected = selectedTheme === t.id;

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTheme(t.id);
                        // Preview theme immediately
                        setTheme(t.id);
                      }}
                      className={`relative p-3 rounded-xl border-2 transition-all duration-200 text-left ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                          : "border-border/50 bg-card/50 hover:border-border hover:bg-card"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}

                      {/* Theme Preview Colors */}
                      <div className="flex gap-1 mb-2">
                        <div
                          className="w-4 h-4 rounded-full border border-border/30"
                          style={{ backgroundColor: t.preview.bg }}
                        />
                        <div
                          className="w-4 h-4 rounded-full border border-border/30"
                          style={{ backgroundColor: t.preview.card }}
                        />
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: t.preview.primary }}
                        />
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: t.preview.accent }}
                        />
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium text-xs text-foreground">
                          {t.name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {t.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 px-6 py-4 bg-card/40">
          <div className="flex gap-3">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="flex-1 h-11 border-border/50 bg-transparent"
              >
                Back
              </Button>
            )}
            {step < totalSteps ? (
              <Button
                onClick={() => {
                  if (step === 1 && !schoolName) {
                    setError("Please enter your school name");
                    return;
                  }
                  if (step === 2 && !formClass) {
                    setError("Please select your form level");
                    return;
                  }
                  setError("");
                  setStep(step + 1);
                }}
                className="flex-1 h-11 bg-primary hover:bg-primary/90"
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 h-11 bg-chart-3 hover:bg-chart-3/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Complete Profile
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
