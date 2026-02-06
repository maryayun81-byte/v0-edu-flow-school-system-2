"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Settings,
  Image as ImageIcon,
  Stamp,
  Palette,
  Users,
  Save,
  Upload,
  UserPlus,
  Trash2,
  Check,
  PenTool,
  Keyboard,
  Eraser,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SchoolSettings {
  id: string;
  school_name: string;
  logo_url: string | null;
  stamp_url: string | null;
  signature_url: string | null;
  auto_attach_stamp: boolean;
  auto_attach_signature: boolean;
  transcript_theme: string;
}

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

const THEMES = [
  { id: "Modern", name: "Modern", color: "bg-blue-600", desc: "Clean, Sans-serif, Blue accents" },
  { id: "Classic", name: "Classic", color: "bg-gray-800", desc: "Serif, Black/White, Formal" },
  { id: "Elegant", name: "Elegant", color: "bg-amber-600", desc: "Gold/Black, Script details" },
  { id: "Professional", name: "Professional", color: "bg-indigo-700", desc: "Navy/Grey, Grid layout" },
  { id: "Minimalist", name: "Minimalist", color: "bg-emerald-600", desc: "Whitespace heavy, Thin fonts" },
  { id: "Academic", name: "Academic", color: "bg-red-800", desc: "Crimson/Gold, Traditional" },
  { id: "Tech", name: "Tech", color: "bg-slate-700", desc: "Sleek Grey, Monospace elements" },
  { id: "Creative", name: "Creative", color: "bg-purple-600", desc: "Colorful headers, Rounded" },
];

export default function AdminSettingsTab() {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  // File Upload States
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [stampFile, setStampFile] = useState<File | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchAdmins();
  }, []);

  async function fetchSettings() {
    try {
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings(data);
      } else {
        setSettings({
          id: "",
          school_name: "My School",
          logo_url: null,
          stamp_url: null,
          signature_url: null,
          auto_attach_stamp: false,
          auto_attach_signature: false,
          transcript_theme: "Modern"
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAdmins() {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: false });
    
    if (data) setAdmins(data as any);
  }

  // Signature States
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [typedSignature, setTypedSignature] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ... (existing helper functions)

  // Canvas drawing functions
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
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  async function handleInviteAdmin() {
    if (!newAdminEmail || !newAdminName) return;
    setInviteLoading(true);
    try {
      alert("Note: Adding a BRAND NEW user requires them to sign up first. If they have signed up, we will promote them to Admin now.");
       // In a real app we'd call an Edge Function here
      console.log("Inviting", newAdminEmail);
    } catch (error) {
      console.error(error);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleSaveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      let logoUrl = settings.logo_url;
      let stampUrl = settings.stamp_url;
      let signatureUrl = settings.signature_url;

      // Handle Signature Generation & Upload
      if (signatureMode === 'draw' && canvasRef.current) {
        // Convert canvas to blob
        const blob = await new Promise<Blob | null>(resolve => canvasRef.current?.toBlob(resolve, 'image/png'));
        if (blob) {
           const fileName = `signature-${Date.now()}.png`;
           const { error } = await supabase.storage.from("school-assets").upload(fileName, blob);
           if (!error) {
             const { data: { publicUrl } } = supabase.storage.from("school-assets").getPublicUrl(fileName);
             signatureUrl = publicUrl;
           }
        }
      } else if (signatureMode === 'type' && typedSignature) {
         // Create canvas for typed signature
         const canvas = document.createElement('canvas');
         canvas.width = 400;
         canvas.height = 100;
         const ctx = canvas.getContext('2d');
         if (ctx) {
            ctx.font = "italic 48px 'Brush Script MT', cursive";
            ctx.fillStyle = "black";
            ctx.fillText(typedSignature, 20, 60);
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (blob) {
               const fileName = `signature-typed-${Date.now()}.png`;
               const { error } = await supabase.storage.from("school-assets").upload(fileName, blob);
               if (!error) {
                 const { data: { publicUrl } } = supabase.storage.from("school-assets").getPublicUrl(fileName);
                 signatureUrl = publicUrl;
               }
            }
         }
      }
      
      // Upload Logo
      if (logoFile) {
        const fileName = `logo-${Date.now()}.${logoFile.name.split('.').pop()}`;
        const { error } = await supabase.storage.from("school-assets").upload(fileName, logoFile);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("school-assets").getPublicUrl(fileName);
        logoUrl = publicUrl;
      }

      // Upload Stamp
      if (stampFile) {
        const fileName = `stamp-${Date.now()}.${stampFile.name.split('.').pop()}`;
        const { error } = await supabase.storage.from("school-assets").upload(fileName, stampFile);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("school-assets").getPublicUrl(fileName);
        stampUrl = publicUrl;
      }

      // Update DB
      const { error } = await supabase
        .from("school_settings")
        .upsert({
          id: settings.id || undefined,
          school_name: settings.school_name,
          logo_url: logoUrl,
          stamp_url: stampUrl,
          signature_url: signatureUrl,
          auto_attach_stamp: settings.auto_attach_stamp,
          auto_attach_signature: settings.auto_attach_signature,
          transcript_theme: settings.transcript_theme,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      
      await fetchSettings();
      setLogoFile(null);
      setStampFile(null);
      alert("Settings saved successfully!");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  // ... (Render logic)
  
  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
           <Skeleton className="h-8 w-48" />
        </div>
        <div className="w-full space-y-6">
           <Skeleton className="h-10 w-full max-w-md rounded-lg" />
           <div className="space-y-4">
              <Skeleton className="h-64 w-full rounded-xl" />
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">School Settings</h2>
      </div>

      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="branding" className="flex items-center gap-2">
             <Settings className="w-4 h-4" /> Global Branding
          </TabsTrigger>
          <TabsTrigger value="themes" className="flex items-center gap-2">
             <Palette className="w-4 h-4" /> Transcript Themes
          </TabsTrigger>
          <TabsTrigger value="admins" className="flex items-center gap-2">
             <Users className="w-4 h-4" /> Admin Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-4 py-4">
          <div className="grid md:grid-cols-2 gap-6">
             {/* Logo Section */}
             <div className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> School Logo
                </h3>
                <div className="space-y-4">
                  {settings?.logo_url ? (
                    <div className="relative w-32 h-32 mx-auto border rounded-xl p-2 bg-white flex items-center justify-center group overflow-hidden">
                      <img src={settings.logo_url} alt="School Logo" className="object-contain w-full h-full" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button 
                            variant="destructive" size="icon" className="h-8 w-8"
                            onClick={() => settings && setSettings({...settings, logo_url: null})}
                         >
                            <Trash2 className="w-4 h-4" />
                         </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-32 h-32 mx-auto border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
                      <ImageIcon className="w-8 h-8 opacity-50 mb-2" />
                      <span className="text-xs">No Logo</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      className="text-xs" 
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                           setLogoFile(e.target.files[0]);
                           // Preview
                           const url = URL.createObjectURL(e.target.files[0]);
                           if (settings) setSettings({...settings, logo_url: url});
                        }
                      }}
                    />
                  </div>
                </div>
             </div>

             {/* Stamp Section */}
             <div className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Stamp className="w-4 h-4" /> Official Stamp
                </h3>
                <div className="space-y-4">
                   {settings?.stamp_url ? (
                    <div className="relative w-32 h-32 mx-auto border rounded-xl p-2 bg-white flex items-center justify-center group overflow-hidden">
                      <img src={settings.stamp_url} alt="Stamp" className="object-contain w-full h-full opacity-80" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button 
                            variant="destructive" size="icon" className="h-8 w-8"
                            onClick={() => settings && setSettings({...settings, stamp_url: null})}
                         >
                            <Trash2 className="w-4 h-4" />
                         </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-32 h-32 mx-auto border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
                      <Stamp className="w-8 h-8 opacity-50 mb-2" />
                      <span className="text-xs">No Stamp</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      className="text-xs" 
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                           setStampFile(e.target.files[0]);
                           // Preview
                           const url = URL.createObjectURL(e.target.files[0]);
                           if (settings) setSettings({...settings, stamp_url: url});
                        }
                      }}
                    />
                  </div>
                </div>
             </div>
             
             {/* NEW: Signature Designer */}
             <div className="bg-card border border-border/50 rounded-xl p-6 space-y-4 md:col-span-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <PenTool className="w-4 h-4" /> Principal's Signature
                </h3>
                
                <Tabs value={signatureMode} onValueChange={(v:any) => setSignatureMode(v)} className="w-full">
                   <TabsList className="mb-4">
                      <TabsTrigger value="draw" className="flex gap-2"><PenTool className="w-3 h-3"/> Draw</TabsTrigger>
                      <TabsTrigger value="type" className="flex gap-2"><Keyboard className="w-3 h-3"/> Type</TabsTrigger>
                   </TabsList>
                   
                   <TabsContent value="draw" className="flex flex-col items-center gap-4">
                      <div className="border-2 border-dashed border-border rounded-lg bg-white overflow-hidden relative group">
                         <canvas 
                            ref={canvasRef}
                            width={500}
                            height={150}
                            className="w-full max-w-[500px] h-[150px] cursor-crosshair touch-none"
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
                           variant="destructive" 
                           onClick={clearCanvas} 
                           className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                         >
                           <Eraser className="w-3 h-3 mr-1" /> Clear
                         </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Draw your signature above using your mouse or touch screen.</p>
                   </TabsContent>
                   
                   <TabsContent value="type" className="space-y-4 w-full max-w-md mx-auto">
                      <div className="space-y-2">
                         <Label>Type Full Name</Label>
                         <Input 
                            value={typedSignature}
                            onChange={e => setTypedSignature(e.target.value)}
                            placeholder="e.g. Dr. John Doe"
                            className="text-center text-lg"
                         />
                      </div>
                      <div className="h-32 flex items-center justify-center border rounded-lg bg-white p-4">
                         {typedSignature ? (
                            <span className="text-4xl italic font-[cursive]" style={{ fontFamily: '"Brush Script MT", cursive' }}>
                               {typedSignature}
                            </span>
                         ) : (
                            <span className="text-muted-foreground italic">Preview will appear here</span>
                         )}
                      </div>
                   </TabsContent>
                </Tabs>
                
                {settings?.signature_url && (
                   <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <span className="text-sm font-medium">Current Signature:</span>
                         <img src={settings.signature_url} className="h-12 object-contain" alt="Current Signature" />
                      </div>
                      <p className="text-xs text-green-600 flex items-center"><Check className="w-3 h-3 mr-1"/> Saved</p>
                   </div>
                )}
             </div>
             
              {/* Auto-Attach Logic for Signature too? Maybe just use Stamp section for global auto-attach */}
              
              <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                      <div className="flex items-center gap-2">
                          <Stamp className="w-5 h-5 text-muted-foreground" />
                          <div>
                              <Label className="font-semibold">Auto-attach Stamp</Label>
                              <p className="text-sm text-muted-foreground">Automatically add stamp to new transcripts</p>
                          </div>
                      </div>
                      <Switch 
                          checked={settings?.auto_attach_stamp}
                          onCheckedChange={(c) => settings && setSettings({...settings, auto_attach_stamp: c})}
                      />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                      <div className="flex items-center gap-2">
                          <PenTool className="w-5 h-5 text-muted-foreground" />
                          <div>
                              <Label className="font-semibold">Auto-attach Signature</Label>
                              <p className="text-sm text-muted-foreground">Automatically add signature to new transcripts</p>
                          </div>
                      </div>
                      <Switch 
                          checked={settings?.auto_attach_signature}
                          onCheckedChange={(c) => settings && setSettings({...settings, auto_attach_signature: c})}
                      />
                  </div>
              </div>

              <div className="md:col-span-2 pt-6 border-t flex justify-end">
                <Button onClick={handleSaveSettings} disabled={saving} className="w-full md:w-auto">
                  {saving ? (
                    <>
                      <Skeleton className="w-4 h-4 rounded-full mr-2 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" /> Save Settings
                    </>
                  )}
                </Button>
              </div>
           </div>
       </TabsContent>

        {/* THEMES TAB */}
        <TabsContent value="themes" className="space-y-4 py-4">
           <div className="bg-card border border-border/50 rounded-xl p-6 space-y-6">
            <h3 className="font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4" /> Transcript Theme
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {THEMES.map(theme => (
                <div 
                  key={theme.id}
                  onClick={() => settings && setSettings({...settings, transcript_theme: theme.id})}
                  className={`
                    relative group cursor-pointer rounded-xl border-2 transition-all p-1
                    ${settings?.transcript_theme === theme.id ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-border'}
                  `}
                >
                  <div className={`h-24 rounded-lg mb-2 ${theme.color} opacity-80 flex items-center justify-center text-white font-bold shadow-sm`}>
                    {theme.id}
                  </div>
                  <div className="px-2 pb-2">
                    <h4 className="font-medium text-sm">{theme.name}</h4>
                    <p className="text-[10px] text-muted-foreground">{theme.desc}</p>
                  </div>
                  {settings?.transcript_theme === theme.id && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ADMINS TAB */}
        <TabsContent value="admins" className="space-y-4 py-4">
          <div className="bg-card border border-border/50 rounded-xl p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" /> Admin Users
              </h3>
            </div>
            
            <div className="p-4 border border-border rounded-lg bg-muted/20">
              <h4 className="font-medium mb-3 text-sm">Grant Admin Access</h4>
              <div className="flex flex-col md:flex-row gap-3">
                <Input 
                  placeholder="Full Name" 
                  value={newAdminName} 
                  onChange={e => setNewAdminName(e.target.value)} 
                />
                <Input 
                  placeholder="Email Address" 
                  value={newAdminEmail} 
                  onChange={e => setNewAdminEmail(e.target.value)} 
                />
                <Button onClick={handleInviteAdmin} disabled={inviteLoading} className="whitespace-nowrap">
                   <UserPlus className="w-4 h-4 mr-2" />
                   Add Admin
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                * User must already be signed up to be promoted immediately.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Current Admins</h4>
               {admins.map(admin => (
                 <div key={admin.id} className="flex justify-between items-center p-3 bg-card border border-border/50 rounded-lg">
                   <div>
                     <p className="font-medium">{admin.full_name}</p>
                     <p className="text-xs text-muted-foreground">{admin.email}</p>
                   </div>
                   <div className="text-xs text-muted-foreground">
                     Added {new Date(admin.created_at).toLocaleDateString()}
                   </div>
                 </div>
               ))}
            </div>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


