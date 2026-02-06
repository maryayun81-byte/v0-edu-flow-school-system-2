"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Save,
  Edit,
  ArrowRight,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface GradingSystem {
  id: string;
  name: string;
  is_active: boolean;
}

interface GradeScale {
  id?: string;
  grade_label: string;
  min_percentage: number;
  max_percentage: number;
  grade_points: number;
  remarks: string;
}

interface SubjectOverride {
  id?: string;
  subject_id: string;
  grade_label: string;
  min_percentage: number;
  max_percentage: number;
  grade_points: number;
  remarks: string;
}

export default function GradingSystemManager() {
  const [systems, setSystems] = useState<GradingSystem[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [scales, setScales] = useState<GradeScale[]>([]);
  const [overrides, setOverrides] = useState<SubjectOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Validation State
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystems();
  }, []);

  useEffect(() => {
    if (selectedSystemId) {
      fetchScales(selectedSystemId);
      // fetchOverrides(selectedSystemId); // TODO: Implement override fetching
    } else {
      setScales([]);
    }
  }, [selectedSystemId]);

  async function fetchSystems() {
    const { data } = await supabase.from("grading_systems").select("*").order("created_at", { ascending: false });
    if (data) {
      setSystems(data);
      if (data.length > 0 && !selectedSystemId) {
         // Auto-select active one or first
         const active = data.find(s => s.is_active);
         setSelectedSystemId(active ? active.id : data[0].id);
      }
    }
    setLoading(false);
  }

  async function fetchScales(systemId: string) {
    const { data } = await supabase
      .from("grading_scales")
      .select("*")
      .eq("grading_system_id", systemId)
      .order("min_percentage", { ascending: false });
    if (data) setScales(data);
  }

  async function handleCreateSystem() {
    const name = prompt("Enter name for new grading system (e.g. 'KCSE 2026'):");
    if (!name) return;

    const { data, error } = await supabase.from("grading_systems").insert({ name, is_active: false }).select().single();
    if (data) {
        setSystems([data, ...systems]);
        setSelectedSystemId(data.id);
        // Default scales?
    }
  }

  async function handleActivateSystem(system: GradingSystem) {
     if (!confirm(`Activate '${system.name}'? This will apply to ALL new transcripts immediately.`)) return;
     
     // 1. Deactivate all
     await supabase.from("grading_systems").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000"); // Update all
     
     // 2. Activate target
     await supabase.from("grading_systems").update({ is_active: true }).eq("id", system.id);
     
     fetchSystems();
  }

  async function handleSaveScales() {
      if (!selectedSystemId) return;
      
      // Validate
      const sorted = [...scales].sort((a,b) => a.min_percentage - b.min_percentage);
      // Check gaps/overlaps
      for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].max_percentage >= sorted[i+1].min_percentage) {
              setValidationError(`Overlap detected between ${sorted[i].grade_label} and ${sorted[i+1].grade_label}`);
              return;
          }
           if (sorted[i].max_percentage + 1 < sorted[i+1].min_percentage) {
             // Gap warning? Optional.
          }
      }
      setValidationError(null);
      setSaving(true);

      try {
          // Delete old scales for this system (simple replace strategy for now)
          // Ideally upsert, but replacement guarantees no orphans
          await supabase.from("grading_scales").delete().eq("grading_system_id", selectedSystemId);
          
          const payload = scales.map(s => ({
              grading_system_id: selectedSystemId,
              grade_label: s.grade_label,
              min_percentage: s.min_percentage,
              max_percentage: s.max_percentage,
              grade_points: s.grade_points,
              remarks: s.remarks
          }));
          
          const { error } = await supabase.from("grading_scales").insert(payload);
          if (error) throw error;
          
          alert("Grading scale saved successfully!");
      } catch (e: any) {
          alert("Error saving: " + e.message);
      } finally {
          setSaving(false);
      }
  }

  const addScaleRow = () => {
      setScales([...scales, { grade_label: "New", min_percentage: 0, max_percentage: 0, grade_points: 0, remarks: "" }]);
  };

  const updateScale = (index: number, field: keyof GradeScale, value: any) => {
      const newScales = [...scales];
      newScales[index] = { ...newScales[index], [field]: value };
      setScales(newScales);
  };
  
  const removeScale = (index: number) => {
      setScales(scales.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">Grading Configuration</h3>
            <p className="text-sm text-muted-foreground">Manage grading systems and scales</p>
          </div>
          <Button onClick={handleCreateSystem} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" /> New System
          </Button>
       </div>

       {/* System Selector */}
       <div className="flex gap-4 overflow-x-auto pb-2">
           {systems.map(sys => (
               <div 
                 key={sys.id}
                 onClick={() => setSelectedSystemId(sys.id)}
                 className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer min-w-[200px] transition-all
                    ${selectedSystemId === sys.id ? 'border-primary bg-primary/5 shadow-sm' : 'hover:border-primary/50'}
                 `}
               >
                  <div className="flex-1">
                      <p className="font-medium text-sm">{sys.name}</p>
                      {sys.is_active ? (
                          <span className="text-[10px] text-green-600 font-bold flex items-center mt-1">
                             <Check className="w-3 h-3 mr-1" /> ACTIVE
                          </span>
                      ) : (
                          <button onClick={(e) => { e.stopPropagation(); handleActivateSystem(sys); }} className="text-[10px] text-muted-foreground hover:text-primary mt-1 underline">
                             Set Active
                          </button>
                      )}
                  </div>
               </div>
           ))}
       </div>

       {selectedSystemId && (
           <div className="bg-card border rounded-xl p-6 space-y-6">
               <div className="flex justify-between items-center">
                   <h4 className="font-semibold">Grading Scale</h4>
                   {validationError && (
                       <span className="text-red-500 text-sm flex items-center font-medium">
                           <AlertCircle className="w-4 h-4 mr-1" /> {validationError}
                       </span>
                   )}
               </div>

               <div className="border rounded-lg overflow-hidden">
                   <table className="w-full text-sm">
                       <thead className="bg-muted/50 text-left">
                           <tr>
                               <th className="p-3 font-medium">Grade</th>
                               <th className="p-3 font-medium">Range (%)</th>
                               <th className="p-3 font-medium">Points</th>
                               <th className="p-3 font-medium">Remarks</th>
                               <th className="p-3 text-right">Action</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y">
                           {scales.length === 0 && (
                               <tr>
                                   <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                       No grades defined. Add one below.
                                   </td>
                               </tr>
                           )}
                           {scales.map((scale, i) => (
                               <tr key={i} className="group hover:bg-muted/20">
                                   <td className="p-2">
                                       <Input 
                                          value={scale.grade_label} 
                                          onChange={e => updateScale(i, 'grade_label', e.target.value)} 
                                          className="w-16 h-8 text-center font-bold"
                                       />
                                   </td>
                                   <td className="p-2">
                                       <div className="flex items-center gap-2">
                                           <Input 
                                              type="number"
                                              value={scale.min_percentage} 
                                              onChange={e => updateScale(i, 'min_percentage', parseInt(e.target.value))} 
                                              className="w-16 h-8 text-center"
                                           />
                                           <span className="text-muted-foreground">-</span>
                                           <Input 
                                              type="number"
                                              value={scale.max_percentage} 
                                              onChange={e => updateScale(i, 'max_percentage', parseInt(e.target.value))} 
                                              className="w-16 h-8 text-center"
                                           />
                                       </div>
                                   </td>
                                   <td className="p-2">
                                       <Input 
                                          type="number"
                                          value={scale.grade_points} 
                                          onChange={e => updateScale(i, 'grade_points', parseInt(e.target.value))} 
                                          className="w-16 h-8 text-center"
                                       />
                                   </td>
                                   <td className="p-2">
                                       <Input 
                                          value={scale.remarks} 
                                          onChange={e => updateScale(i, 'remarks', e.target.value)} 
                                          className="h-8"
                                       />
                                   </td>
                                   <td className="p-2 text-right">
                                       <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeScale(i)}>
                                           <Trash2 className="w-4 h-4" />
                                       </Button>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
               
               <div className="flex justify-between">
                   <Button variant="outline" onClick={addScaleRow} className="text-primary hover:text-primary border-dashed border-primary/20 bg-primary/5">
                        <Plus className="w-4 h-4 mr-2" /> Add Grade Level
                   </Button>
                   
                   <Button onClick={handleSaveScales} disabled={saving} className="bg-primary hover:bg-primary/90">
                        {saving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                   </Button>
               </div>
           </div>
       )}
       
       <div className="p-4 bg-muted/20 border rounded-lg flex items-start gap-3">
           <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5" />
           <div className="text-sm">
               <p className="font-semibold text-amber-800">Important Note</p>
               <p className="text-muted-foreground">Changes to grading systems will only affect transcripts generated AFTER the change. Existing transcripts will keep their original grades unless you regenerate them.</p>
           </div>
       </div>
    </div>
  );
}
