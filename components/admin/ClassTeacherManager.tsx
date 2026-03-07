"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserCog,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  School,
  Star,
} from "lucide-react";

const supabase = createClient();

interface ClassTeacher {
  id: string;
  class_id: string;
  teacher_id: string;
  designated_at: string;
  classes?: { name: string; form_level: string };
  profiles?: { full_name: string; subject?: string };
}

interface Class {
  id: string;
  name: string;
  form_level: string;
}

interface Teacher {
  id: string;
  full_name: string;
  subject?: string;
}

export default function ClassTeacherManager({ adminId }: { adminId: string }) {
  const [classTeachers, setClassTeachers] = useState<ClassTeacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [ctRes, classRes, teacherRes] = await Promise.all([
      supabase
        .from("class_teachers")
        .select(`
          *,
          classes(name, form_level),
          profiles!class_teachers_teacher_id_fkey(full_name, subject)
        `)
        .order("designated_at", { ascending: false }),
      supabase.from("classes").select("id, name, form_level").order("name"),
      supabase.from("profiles").select("id, full_name, subject").eq("role", "teacher").order("full_name"),
    ]);

    setClassTeachers(ctRes.data || []);
    setClasses(classRes.data || []);
    setTeachers(teacherRes.data || []);
    setLoading(false);
  }

  // Classes that don't yet have a class teacher designated
  const availableClasses = classes.filter(
    c => !classTeachers.some(ct => ct.class_id === c.id)
  );

  // Teachers not yet designated as class teacher anywhere
  const availableTeachers = teachers.filter(
    t => !classTeachers.some(ct => ct.teacher_id === t.id)
  );

  async function handleDesignate() {
    if (!selectedClass || !selectedTeacher) {
      setError("Please select both a class and a teacher.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");

    // Double-check constraints client-side for clear UX
    const teacherAlreadyDesignated = classTeachers.some(
      ct => ct.teacher_id === selectedTeacher
    );
    if (teacherAlreadyDesignated) {
      setError("This teacher is already designated as class teacher for another class.");
      setSubmitting(false);
      return;
    }

    const classAlreadyHasTeacher = classTeachers.some(
      ct => ct.class_id === selectedClass
    );
    if (classAlreadyHasTeacher) {
      setError("This class already has a designated class teacher.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("class_teachers").insert({
      class_id: selectedClass,
      teacher_id: selectedTeacher,
      designated_by: adminId,
    });

    if (insertError) {
      // Handle DB unique constraint violation
      if (
        insertError.code === "23505" ||
        insertError.message?.includes("unique") ||
        insertError.message?.includes("duplicate")
      ) {
        if (insertError.message?.includes("class_teachers_teacher_id_key")) {
          setError("This teacher is already designated as class teacher for another class.");
        } else {
          setError("This class already has a designated class teacher.");
        }
      } else {
        setError(insertError.message);
      }
    } else {
      setSuccess("Class teacher designated successfully.");
      setSelectedClass("");
      setSelectedTeacher("");
      setShowForm(false);
      fetchAll();
    }
    setSubmitting(false);
  }

  async function handleRemove(id: string) {
    if (!confirm("Remove this class teacher designation? The teacher will no longer be able to mark the register.")) return;
    await supabase.from("class_teachers").delete().eq("id", id);
    fetchAll();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Class Teachers</h2>
          <p className="text-sm text-muted-foreground">
            Designate one class teacher per class. Only class teachers can mark the attendance register.
          </p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setError(""); }} className="bg-primary">
          <Plus className="w-4 h-4 mr-2" />
          Designate
        </Button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-4 py-3 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Designation Form */}
      {showForm && (
        <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Designate Class Teacher</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Select Class</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="bg-muted border-border/50">
                  <SelectValue placeholder="Choose a class..." />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.length === 0 ? (
                    <SelectItem value="_none" disabled>All classes have class teachers</SelectItem>
                  ) : (
                    availableClasses.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} ({cls.form_level})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Select Teacher</label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger className="bg-muted border-border/50">
                  <SelectValue placeholder="Choose a teacher..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTeachers.length === 0 ? (
                    <SelectItem value="_none" disabled>All teachers are already class teachers</SelectItem>
                  ) : (
                    availableTeachers.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name}
                        {t.subject ? ` (${t.subject})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-400">
              Each teacher can only be class teacher for <strong>one class</strong>, and each class can only have <strong>one class teacher</strong>.
              Only the designated class teacher will be able to mark the daily attendance register.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowForm(false)} className="bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleDesignate} disabled={submitting} className="bg-primary">
              {submitting ? "Saving..." : "Designate Class Teacher"}
            </Button>
          </div>
        </div>
      )}

      {/* Current Designations */}
      {classTeachers.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/50 rounded-2xl">
          <UserCog className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Class Teachers Designated</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Designate class teachers so they can mark attendance registers.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h3 className="font-semibold text-foreground">
              Current Designations ({classTeachers.length})
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {classTeachers.map(ct => (
              <div key={ct.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-4">
                  {/* Class */}
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <School className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {(ct as any).classes?.name || "Unknown Class"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(ct as any).classes?.form_level}
                      </p>
                    </div>
                  </div>

                  <div className="text-muted-foreground">→</div>

                  {/* Teacher */}
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Star className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {(ct as any).profiles?.full_name || "Unknown Teacher"}
                      </p>
                      <div className="flex items-center gap-2">
                        {(ct as any).profiles?.subject && (
                          <Badge variant="outline" className="text-[10px] py-0 bg-transparent">
                            {(ct as any).profiles.subject}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Since {new Date(ct.designated_at).toLocaleDateString("en-KE", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">
                    Active
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemove(ct.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned Classes Warning */}
      {classes.length > 0 && availableClasses.length > 0 && (
        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-medium text-amber-400">
              {availableClasses.length} class{availableClasses.length > 1 ? "es" : ""} without a class teacher
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableClasses.map(c => (
              <Badge key={c.id} variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-xs">
                {c.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
