"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Check, AlertCircle, BookOpen } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TeacherClassManagerProps {
  teacherId: string;
  teacherName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface AssignedClass {
  class_id: string;
  class_name: string;
  subjects: string[];
}

interface Preference {
  subject: string;
  preferred_classes: string[];
}

export default function TeacherClassManager({
  teacherId,
  teacherName,
  isOpen,
  onClose,
}: TeacherClassManagerProps) {
  const [loading, setLoading] = useState(true);
  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [allClasses, setAllClasses] = useState<{ id: string; name: string }[]>([]);
  const [allSubjects, setAllSubjects] = useState<{ id: string; name: string }[]>([]);
  
  // New Assignment State
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen && teacherId) {
      fetchData();
    }
  }, [isOpen, teacherId]);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Fetch Official Assignments
      const { data: official, error: officialError } = await supabase
        .from("teacher_classes")
        .select(`
          class_id,
          subjects,
          classes (id, name)
        `)
        .eq("teacher_id", teacherId);

      if (officialError) throw officialError;

      const formattedOfficial = official.map((item: any) => ({
        class_id: item.class_id,
        class_name: item.classes?.name || "Unknown Class",
        subjects: item.subjects || [],
      }));
      setAssignedClasses(formattedOfficial);

      // 2. Fetch Preferences
      const { data: prefs, error: prefsError } = await supabase
        .from("teacher_subject_preferences")
        .select("subject, preferred_classes")
        .eq("teacher_id", teacherId);

      if (prefsError) throw prefsError;
      setPreferences(prefs || []);

      // 3. Fetch All Classes (for dropdown)
      const { data: classesData } = await supabase
        .from("classes")
        .select("id, name")
        .order("name");
      setAllClasses(classesData || []);

      // 4. Fetch All Subjects (for dropdown)
      const { data: subjectsData } = await supabase
        .from("subjects")
        .select("id, name")
        .order("name");
      setAllSubjects(subjectsData || []);

    } catch (error) {
      console.error("Error fetching teacher class data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAssignment() {
    if (!selectedClassId || !selectedSubject) return;
    setAdding(true);

    try {
      // Check if assignment exists
      const existing = assignedClasses.find(a => a.class_id === selectedClassId);
      
      if (existing) {
        // Update existing: Add subject if unique
        if (!existing.subjects.includes(selectedSubject)) {
          const newSubjects = [...existing.subjects, selectedSubject];
          const { error } = await supabase
            .from("teacher_classes")
            .update({ subjects: newSubjects })
            .eq("teacher_id", teacherId)
            .eq("class_id", selectedClassId);
            
          if (error) throw error;
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from("teacher_classes")
          .insert({
            teacher_id: teacherId,
            class_id: selectedClassId,
            subjects: [selectedSubject]
          });
          
        if (error) throw error;
      }

      await fetchData(); // Refresh
      setSelectedClassId("");
      setSelectedSubject("");
    } catch (error) {
      console.error("Error adding assignment:", error);
      alert("Failed to add assignment");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveSubject(classId: string, subjectToRemove: string) {
    if (!confirm(`Remove ${subjectToRemove} from this class?`)) return;

    try {
      const assignment = assignedClasses.find(a => a.class_id === classId);
      if (!assignment) return;

      const newSubjects = assignment.subjects.filter(s => s !== subjectToRemove);

      if (newSubjects.length === 0) {
        // If no subjects left, delete the row
        const { error } = await supabase
          .from("teacher_classes")
          .delete()
          .eq("teacher_id", teacherId)
          .eq("class_id", classId);
        if (error) throw error;
      } else {
        // Update subjects
        const { error } = await supabase
          .from("teacher_classes")
          .update({ subjects: newSubjects })
          .eq("teacher_id", teacherId)
          .eq("class_id", classId);
        if (error) throw error;
      }

      await fetchData();
    } catch (error) {
      console.error("Error removing subject:", error);
      alert("Failed to remove subject");
    }
  }

  // Auto-accept a preference
  async function handleAcceptPreference(prefSubject: string, prefClass: string) {
    // Find class ID for the preferred class name
    // Matches logic in migration script (basic name matching)
    const targetClass = allClasses.find(c => 
      c.name.toLowerCase() === prefClass.toLowerCase() || 
      c.name.toLowerCase().includes(prefClass.toLowerCase())
    );

    if (!targetClass) {
      alert(`Could not find a valid class matching "${prefClass}". Please add manually.`);
      return;
    }

    setAdding(true);
    try {
        // Re-use add logic
        const existing = assignedClasses.find(a => a.class_id === targetClass.id);
        if (existing) {
            if (!existing.subjects.includes(prefSubject)) {
                await supabase.from("teacher_classes")
                    .update({ subjects: [...existing.subjects, prefSubject] })
                    .eq("teacher_id", teacherId)
                    .eq("class_id", targetClass.id);
            }
        } else {
            await supabase.from("teacher_classes")
                .insert({
                    teacher_id: teacherId,
                    class_id: targetClass.id,
                    subjects: [prefSubject]
                });
        }
        await fetchData();
    } catch (e) {
        console.error("Error accepting preference:", e);
    } finally {
        setAdding(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Classes for {teacherName}</DialogTitle>
          <DialogDescription>
            Assign classes and subjects to this teacher.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* 1. Official Assignments */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                Official Assignments
              </h3>
              
              {assignedClasses.length === 0 ? (
                <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground bg-muted/30">
                  No classes officially assigned yet.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {assignedClasses.map((assignment) => (
                    <div key={assignment.class_id} className="p-4 rounded-xl border bg-card/50">
                      <div className="font-bold text-lg mb-2">{assignment.class_name}</div>
                      <div className="flex flex-wrap gap-2">
                        {assignment.subjects.map((subj) => (
                          <Badge key={subj} variant="secondary" className="flex items-center gap-1 group cursor-default">
                             {subj}
                             <button 
                                onClick={() => handleRemoveSubject(assignment.class_id, subj)}
                                className="w-4 h-4 rounded-full hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                             >
                                <Trash2 className="w-3 h-3" />
                             </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Add New */}
            <div className="p-5 rounded-xl border bg-primary/5 space-y-4">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add New Assignment
                </h3>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select Class" />
                      </SelectTrigger>
                      <SelectContent>
                        {allClasses.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                     <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select Subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {allSubjects.map(s => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddAssignment} disabled={adding || !selectedClassId || !selectedSubject}>
                     {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign"}
                  </Button>
                </div>
            </div>

            {/* 3. Onboarding Preferences */}
            {preferences.length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                 <h3 className="font-semibold text-lg flex items-center gap-2 text-muted-foreground">
                    <BookOpen className="w-5 h-5" />
                    Onboarding Requests (Preferences)
                 </h3>
                 <p className="text-sm text-muted-foreground">
                    The teacher requested these during sign-up. Click to officially approve them.
                 </p>
                 <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {preferences.map((pref, idx) => (
                        <div key={idx} className="p-3 bg-muted/30 rounded-lg border flex flex-col gap-2">
                            <div className="font-medium">{pref.subject}</div>
                            <div className="flex flex-wrap gap-2">
                                {pref.preferred_classes.map(clsName => (
                                    <Badge 
                                        key={clsName} 
                                        variant="outline" 
                                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                        onClick={() => handleAcceptPreference(pref.subject, clsName)}
                                    >
                                        + {clsName}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    ))}
                 </div>
              </div>
            )}

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
