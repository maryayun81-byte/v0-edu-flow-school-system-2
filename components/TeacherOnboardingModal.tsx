"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { X, BookOpen, GraduationCap } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SUBJECTS = [
  "Mathematics", "English", "Kiswahili", "Biology", "Chemistry", "Physics",
  "History", "Geography", "CRE", "IRE", "HRE", "Business Studies",
  "Agriculture", "Home Science", "Computer Studies", "French", "German",
  "Music", "Art & Design", "Physical Education"
];

const CLASS_LEVELS = [
  "Form 1", "Form 2", "Form 3", "Form 4",
  "Grade 7", "Grade 8", "Grade 9"
];

interface TeacherOnboardingModalProps {
  teacherId: string;
  teacherName: string;
  onComplete: () => void;
}

export default function TeacherOnboardingModal({
  teacherId,
  teacherName,
  onComplete
}: TeacherOnboardingModalProps) {
  const [selectedCurricula, setSelectedCurricula] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectClassPreferences, setSubjectClassPreferences] = useState<Record<string, string[]>>({});
  const [currentStep, setCurrentStep] = useState(0); // Start at 0 for curriculum selection
  const [saving, setSaving] = useState(false);

  function toggleSubject(subject: string) {
    setSelectedSubjects(prev => {
      if (prev.includes(subject)) {
        // Remove subject and its class preferences
        const newPrefs = { ...subjectClassPreferences };
        delete newPrefs[subject];
        setSubjectClassPreferences(newPrefs);
        return prev.filter(s => s !== subject);
      } else {
        return [...prev, subject];
      }
    });
  }

  function toggleClassForSubject(subject: string, classLevel: string) {
    setSubjectClassPreferences(prev => {
      const currentClasses = prev[subject] || [];
      return {
        ...prev,
        [subject]: currentClasses.includes(classLevel)
          ? currentClasses.filter(c => c !== classLevel)
          : [...currentClasses, classLevel]
      };
    });
  }

  async function handleComplete() {
    if (selectedSubjects.length === 0) {
      alert("Please select at least one subject");
      return;
    }

    setSaving(true);
    try {
      // Insert subject preferences
      const preferences = selectedSubjects.map(subject => ({
        teacher_id: teacherId,
        subject,
        preferred_classes: subjectClassPreferences[subject] || []
      }));

      const { error: prefError } = await supabase
        .from("teacher_subject_preferences")
        .insert(preferences);

      if (prefError) throw prefError;

      // Mark onboarding as completed
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", teacherId);

      if (profileError) throw profileError;

      onComplete();
    } catch (error) {
      console.error("Error saving preferences:", error);
      alert("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border/50 rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Welcome, {teacherName}!</h2>
              <p className="text-sm text-muted-foreground">Let's set up your teaching preferences</p>
            </div>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-4">
             <div className={`flex-1 h-2 rounded-full ${currentStep >= 0 ? 'bg-primary' : 'bg-muted'}`} />
             <div className={`flex-1 h-2 rounded-full ${currentStep >= 1 ? 'bg-primary' : 'bg-muted'}`} />
             <div className={`flex-1 h-2 rounded-full ${currentStep >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Curriculum</span>
            <span>Subjects</span>
            <span>Classes</span>
          </div>
        </div>

        {/* Step 0: Select Curriculum */}
        {currentStep === 0 && (
           <div className="space-y-6">
              <div>
                 <Label className="text-base">Which curriculum do you teach?</Label>
                 <p className="text-sm text-muted-foreground mt-1">Select all that apply.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 {['CBC', '8-4-4'].map(sys => (
                    <div 
                      key={sys}
                      onClick={() => setSelectedCurricula(prev => prev.includes(sys) ? prev.filter(s => s !== sys) : [...prev, sys])}
                      className={`p-6 border rounded-xl cursor-pointer transition-all text-center ${
                          selectedCurricula.includes(sys) ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-border/50 hover:bg-muted/50'
                      }`}
                    >
                       <div className="font-bold text-lg mb-1">{sys}</div>
                       <div className="text-xs text-muted-foreground">{sys === 'CBC' ? 'Junior School (Grades)' : 'High School (Forms)'}</div>
                       <Checkbox checked={selectedCurricula.includes(sys)} className="mt-4" />
                    </div>
                 ))}
              </div>
              <div className="flex justify-end pt-4">
                  <Button 
                    onClick={() => setCurrentStep(1)} 
                    disabled={selectedCurricula.length === 0}
                    className="bg-primary"
                  >
                    Next: Select Subjects
                  </Button>
              </div>
           </div>
        )}

        {/* Step 1: Select Subjects */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="text-base">Which subjects do you teach?</Label>
              <p className="text-sm text-muted-foreground mt-1">Select all subjects you're comfortable teaching</p>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto p-2 bg-muted/50 rounded-lg border border-border/50">
              {SUBJECTS.map(subject => (
                <div
                  key={subject}
                  onClick={() => toggleSubject(subject)}
                  className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                    selectedSubjects.includes(subject)
                      ? "bg-primary/20 border border-primary/50"
                      : "hover:bg-muted border border-transparent"
                  }`}
                >
                  <Checkbox checked={selectedSubjects.includes(subject)} />
                  <span className="text-sm text-foreground">{subject}</span>
                </div>
              ))}
            </div>

            {selectedSubjects.length > 0 && (
              <p className="text-sm text-accent">
                {selectedSubjects.length} subject{selectedSubjects.length > 1 ? 's' : ''} selected
              </p>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                onClick={() => setCurrentStep(2)}
                disabled={selectedSubjects.length === 0}
                className="bg-primary"
              >
                Next: Class Preferences
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Class Preferences */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <Label className="text-base">Which classes are you comfortable teaching?</Label>
              <p className="text-sm text-muted-foreground mt-1">For each subject, select your preferred class levels</p>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {selectedSubjects.map(subject => (
                <div key={subject} className="p-4 bg-muted/50 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-foreground">{subject}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {CLASS_LEVELS.filter(level => {
                        const isCBC = level.startsWith('Grade');
                        const is844 = level.startsWith('Form');
                        if (isCBC && !selectedCurricula.includes('CBC')) return false;
                        if (is844 && !selectedCurricula.includes('8-4-4')) return false;
                        return true;
                    }).map(classLevel => (
                      <div
                        key={classLevel}
                        onClick={() => toggleClassForSubject(subject, classLevel)}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                          (subjectClassPreferences[subject] || []).includes(classLevel)
                            ? "bg-primary/20 border border-primary/50"
                            : "hover:bg-muted border border-transparent"
                        }`}
                      >
                        <Checkbox checked={(subjectClassPreferences[subject] || []).includes(classLevel)} />
                        <span className="text-xs text-foreground">{classLevel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
              >
                Back
              </Button>
              <Button
                onClick={handleComplete}
                disabled={saving}
                className="bg-primary"
              >
                {saving ? "Saving..." : "Complete Setup"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
