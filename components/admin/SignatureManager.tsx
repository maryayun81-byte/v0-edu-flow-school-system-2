"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  PenTool,
  Upload,
  Keyboard,
  Check,
  Trash2,
  Save,
  Loader2,
  Eraser
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Signature {
  id: string;
  role: string;
  signature_type: 'drawn' | 'typed' | 'image' | 'upload';
  signature_url: string | null;
  signature_data: string | null;
  is_active: boolean;
}

const ROLES = ["Principal", "Head Teacher", "Registrar", "Examination Officer"];

export default function SignatureManager() {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [saving, setSaving] = useState(false);
  
  // Edit State
  const [mode, setMode] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedName, setTypedName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    fetchSignatures();
  }, []);

  async function fetchSignatures() {
    const { data } = await supabase.from("signatures").select("*");
    if (data) setSignatures(data);
    setLoading(false);
  }
  
  const currentSignature = signatures.find(s => s.role === selectedRole && s.is_active);

  // Canvas Logic
  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  async function handleSave() {
     setSaving(true);
     try {
         let signatureUrl: string | null = null;
         let signatureData: string | null = null;
         let type = mode;

         if (mode === 'draw' && canvasRef.current) {
             const blob = await new Promise<Blob | null>(resolve => canvasRef.current?.toBlob(resolve, 'image/png'));
             if (blob) {
                 const fileName = `sig-${selectedRole}-${Date.now()}.png`;
                 const { error } = await supabase.storage.from("school-assets").upload(fileName, blob);
                 if (error) throw error;
                 const { data } = supabase.storage.from("school-assets").getPublicUrl(fileName);
                 signatureUrl = data.publicUrl;
             }
         } else if (mode === 'type') {
             if (!typedName) return alert("Please type a name");
             signatureData = typedName; 
             // Ideally we render this to an image too for consistency in reports, 
             // but storing the text allows re-rendering. 
             // For simplicity, let's render to image canvas then upload.
             const canvas = document.createElement('canvas');
             canvas.width = 400; canvas.height = 100;
             const ctx = canvas.getContext('2d');
             if (ctx) {
                 ctx.font = "italic 48px 'Brush Script MT', cursive";
                 ctx.fillStyle = "black";
                 ctx.fillText(typedName, 20, 60);
                 const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                 if (blob) {
                    const fileName = `sig-typed-${selectedRole}-${Date.now()}.png`;
                    await supabase.storage.from("school-assets").upload(fileName, blob);
                    signatureUrl = supabase.storage.from("school-assets").getPublicUrl(fileName).data.publicUrl;
                 }
             }
         } else if (mode === 'upload' && uploadFile) {
             const fileName = `sig-upload-${selectedRole}-${Date.now()}.${uploadFile.name.split('.').pop()}`;
             const { error } = await supabase.storage.from("school-assets").upload(fileName, uploadFile);
             if (error) throw error;
             signatureUrl = supabase.storage.from("school-assets").getPublicUrl(fileName).data.publicUrl;
         }

         // Deactivate old for this role
         await supabase.from("signatures").update({ is_active: false }).eq("role", selectedRole);

         // Map mode to DB constraint check values ('typed', 'drawn', 'image', 'upload')
         let dbType = mode === 'draw' ? 'drawn' : (mode === 'type' ? 'typed' : 'upload');

         // Insert new
         const { error } = await supabase.from("signatures").insert({
             role: selectedRole,
             signature_type: dbType,
             signature_url: signatureUrl,
             signature_data: signatureData,
             is_active: true
         });

         if (error) throw error;
         
         alert("Signature saved!");
         fetchSignatures();
         setUploadFile(null);
         setTypedName("");
         clearCanvas();

     } catch (e: any) {
         console.error(e);
         alert("Failed to save: " + e.message);
     } finally {
         setSaving(false);
     }
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <div>
              <h3 className="text-xl font-bold">Official Signatures</h3>
              <p className="text-sm text-muted-foreground">Manage signatures for transcripts and reports</p>
          </div>
       </div>

       <div className="grid md:grid-cols-3 gap-6">
           <div className="space-y-4">
               <Label>Select Role</Label>
               <Select value={selectedRole} onValueChange={setSelectedRole}>
                   <SelectTrigger>
                       <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                       {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                   </SelectContent>
               </Select>
               
               <div className="p-4 border rounded-lg bg-muted/20">
                   <h4 className="font-semibold text-sm mb-2">Current Signature</h4>
                   {currentSignature ? (
                       <div className="space-y-2">
                           <div className="bg-white p-4 rounded border flex items-center justify-center h-24">
                               {currentSignature.signature_url ? (
                                   <img src={currentSignature.signature_url} className="h-full object-contain" />
                               ) : (
                                   <span className="text-xl font-script italic">{currentSignature.signature_data}</span>
                               )}
                           </div>
                           <p className="text-xs text-muted-foreground">
                               Type: {currentSignature.signature_type} • Active since {new Date().toLocaleDateString()}
                           </p>
                       </div>
                   ) : (
                       <p className="text-sm text-muted-foreground italic">No active signature for {selectedRole}</p>
                   )}
               </div>
           </div>

           <div className="md:col-span-2 space-y-4">
               <Tabs value={mode} onValueChange={(v: any) => setMode(v)} className="w-full">
                   <TabsList className="grid w-full grid-cols-3">
                       <TabsTrigger value="draw"><PenTool className="w-4 h-4 mr-2"/> Draw</TabsTrigger>
                       <TabsTrigger value="type"><Keyboard className="w-4 h-4 mr-2"/> Type</TabsTrigger>
                       <TabsTrigger value="upload"><Upload className="w-4 h-4 mr-2"/> Upload</TabsTrigger>
                   </TabsList>

                   <TabsContent value="draw" className="space-y-4 py-4">
                       <div className="border-2 border-dashed rounded-xl bg-white relative group">
                           <canvas 
                               ref={canvasRef}
                               width={600}
                               height={200}
                               className="w-full h-[200px] cursor-crosshair touch-none"
                               onMouseDown={startDrawing}
                               onMouseMove={draw}
                               onMouseUp={stopDrawing}
                               onMouseLeave={stopDrawing}
                               onTouchStart={startDrawing}
                               onTouchMove={draw}
                               onTouchEnd={stopDrawing}
                           />
                           <Button 
                               size="sm" 
                               variant="outline" 
                               onClick={clearCanvas}
                               className="absolute top-2 right-2"
                           >
                               <Eraser className="w-4 h-4 mr-2"/> Clear
                           </Button>
                       </div>
                       <p className="text-xs text-muted-foreground">Sign inside the box above.</p>
                   </TabsContent>

                   <TabsContent value="type" className="space-y-4 py-4">
                       <div className="space-y-2">
                           <Label>Full Name</Label>
                           <Input 
                               value={typedName} 
                               onChange={e => setTypedName(e.target.value)} 
                               placeholder={`e.g. ${selectedRole} Name`}
                               className="text-lg"
                           />
                       </div>
                       <div className="h-32 border rounded-xl flex items-center justify-center bg-white">
                           {typedName ? (
                               <span className="text-4xl" style={{ fontFamily: '"Brush Script MT", cursive' }}>{typedName}</span>
                           ) : (
                               <span className="text-muted-foreground italic">Preview</span>
                           )}
                       </div>
                   </TabsContent>

                   <TabsContent value="upload" className="space-y-4 py-4">
                       <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center">
                           <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                           <p className="text-sm font-medium">Click to upload signature image</p>
                           <p className="text-xs text-muted-foreground mb-4">PNG or JPG, transparent background recommended</p>
                           <Input 
                               type="file" 
                               accept="image/*" 
                               onChange={e => setUploadFile(e.target.files?.[0] || null)} 
                               className="max-w-xs"
                           />
                       </div>
                   </TabsContent>
               </Tabs>

               <div className="flex justify-end pt-4 border-t">
                   <Button onClick={handleSave} disabled={saving}>
                       {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                       Save Signature
                   </Button>
               </div>
           </div>
       </div>
    </div>
  );
}
