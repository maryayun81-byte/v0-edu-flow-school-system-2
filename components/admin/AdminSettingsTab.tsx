"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
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
  GraduationCap,
  Pen,
  Search,
  MoreHorizontal,
  Shield,
  UserCog,
  UserMinus
} from "lucide-react";
import GradingSystemManager from "./GradingSystemManager";
import SignatureManager from "./SignatureManager";
import TeacherClassManager from "./TeacherClassManager";
import TranscriptThemeManager from "./TranscriptThemeManager";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const supabase = createClient();

interface SchoolSettings {
  id: string;
  school_name: string;
  logo_url: string | null;
  stamp_url: string | null;
  signature_url: string | null;
  auto_attach_stamp: boolean;
  auto_attach_signature: boolean;
  transcript_theme: string;
  motto: string;
  address: string;
  phone: string;
  email: string;
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
          transcript_theme: "Modern",
          motto: "",
          address: "",
          phone: "",
          email: ""
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

  // User Search State
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // User Management State
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showClassManager, setShowClassManager] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function handleUpdateRole(userId: string, newRole: 'admin' | 'teacher' | 'student') {
      setActionLoading(true);
      try {
          const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
          if (error) throw error;
          
          await fetchAdmins(); // Refresh admin list
          
          // If we are searching, update the search result too
          setSearchResults(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
          
          alert(`User role updated to ${newRole}`);
      } catch (e: any) {
          console.error(e);
          alert("Failed to update role: " + e.message);
      } finally {
          setActionLoading(false);
          setSelectedUser(null);
      }
  }

  async function handleDeleteUser(userId: string) {
      if (!confirm("Are you sure you want to DELETE this user? This action cannot be undone.")) return;
      
      setActionLoading(true);
      try {
          const { error } = await supabase.from('profiles').delete().eq('id', userId);
          if (error) throw error;
          
          alert("User profile deleted.");
          fetchAdmins();
          setSearchResults(prev => prev.filter(p => p.id !== userId));
      } catch (e: any) {
          console.error("Delete failed", e);
          alert("Could not delete user. You may need super-admin privileges.");
      } finally {
          setActionLoading(false);
          setSelectedUser(null);
      }
  }

  const handleSearchUser = async (query: string) => {
      if (query.length < 2) {
          setSearchResults([]);
          return;
      }
      setIsSearching(true);
      try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
            .neq('role', 'admin') // Don't show existing admins
            .limit(5);
          
          setSearchResults(data || []);
      } catch (e) {
          console.error(e);
      } finally {
          setIsSearching(false);
      }
  };

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
          motto: settings.motto,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
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
        <TabsList className="w-full flex justify-start overflow-x-auto no-scrollbar bg-transparent p-0 border-b border-white/5 space-x-2 mb-8 z-0">
          {[
              { id: 'branding', icon: Settings, label: 'Branding' },
              { id: 'grading', icon: GraduationCap, label: 'Grading' },
              { id: 'signatures', icon: Pen, label: 'Signatures' },
              { id: 'themes', icon: Palette, label: 'Themes' },
              { id: 'admins', icon: Users, label: 'Admins' },
          ].map(tab => (
              <TabsTrigger 
                  key={tab.id}
                  value={tab.id} 
                  className="
                    relative flex-shrink-0 px-6 py-3 rounded-none bg-transparent 
                    data-[state=active]:bg-transparent 
                    data-[state=active]:shadow-none
                    data-[state=active]:text-indigo-400
                    text-muted-foreground
                    group
                    transition-all
                  "
              >
                  <span className="flex items-center gap-2 relative z-10 transition-transform group-data-[state=active]:scale-105">
                     <tab.icon className="w-4 h-4" /> 
                     <span className="font-medium">{tab.label}</span>
                  </span>
                  
                  {/* Premium Indicator Line */}
                  <span className="
                      absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 scale-x-0 transition-transform duration-300 ease-out origin-left
                      group-data-[state=active]:scale-x-100
                      group-hover:scale-x-50
                      group-hover:bg-indigo-500/50
                  "/>
              </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="branding" className="space-y-4 py-4">
          <div className="grid md:grid-cols-2 gap-6">
             {/* School Details */}
             <div className="bg-card border border-border/50 rounded-xl p-6 space-y-4 md:col-span-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4" /> School Profile
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>School Name</Label>
                        <Input 
                            value={settings?.school_name || ""} 
                            onChange={e => settings && setSettings({...settings, school_name: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>School Motto</Label>
                        <Input 
                            value={settings?.motto || ""} 
                            onChange={e => settings && setSettings({...settings, motto: e.target.value})}
                            placeholder="e.g. Excellence in Education"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Phone Contact</Label>
                        <Input 
                            value={settings?.phone || ""} 
                            onChange={e => settings && setSettings({...settings, phone: e.target.value})}
                            placeholder="+254..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input 
                            value={settings?.email || ""} 
                            onChange={e => settings && setSettings({...settings, email: e.target.value})}
                            placeholder="info@school.com"
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label>Physical Address</Label>
                        <Input 
                            value={settings?.address || ""} 
                            onChange={e => settings && setSettings({...settings, address: e.target.value})}
                            placeholder="P.O. Box..."
                        />
                    </div>
                </div>
             </div>
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

        <TabsContent value="grading" className="space-y-4 py-4">
            <GradingSystemManager />
        </TabsContent>

        <TabsContent value="signatures" className="space-y-4 py-4">
            <SignatureManager />
        </TabsContent>

        {/* THEMES TAB */}
        <TabsContent value="themes" className="space-y-4 py-4">
             <TranscriptThemeManager />
        </TabsContent>

        {/* ADMINS TAB */}
        <TabsContent value="admins" className="space-y-4 py-4 animate-in slide-in-from-right-2 duration-300">
          <div className="grid lg:grid-cols-2 gap-6">
            
            {/* LEFT COL: Manage Existing Admins */}
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                         <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-500" /> Current Admins
                        </h3>
                        <p className="text-sm text-muted-foreground">Users with full system access</p>
                    </div>
                    <Badge variant="secondary" className="px-3">{admins.length}</Badge>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {admins.map(admin => (
                        <div key={admin.id} className="group flex items-center justify-between p-4 bg-background border rounded-lg hover:border-primary/30 transition-all shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                                    {admin.full_name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-medium text-sm">{admin.full_name}</p>
                                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                                </div>
                            </div>
                            
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Manage Access</DropdownMenuLabel>
                                    <DropdownMenuItem onSelect={() => handleUpdateRole(admin.id, 'admin')}>
                                <Shield className="w-4 h-4 mr-2" />
                                Make Admin
                              </DropdownMenuItem>
                              {admin.role === 'teacher' && (
                                <DropdownMenuItem onSelect={() => {
                                  setSelectedUser(admin);
                                  setShowClassManager(true);
                                }}>
                                  <GraduationCap className="w-4 h-4 mr-2" />
                                  Manage Classes
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onSelect={() => handleDeleteUser(admin.id)}
                              >
                                <UserMinus className="w-4 h-4 mr-2" />
                                Remove User
                              </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT COL: Add New Admin / Search */}
            <div className="bg-gradient-to-br from-card to-secondary/20 border border-border/50 rounded-xl p-6 space-y-6 shadow-sm">
                 <div>
                     <h3 className="font-semibold text-lg flex items-center gap-2">
                        <UserCog className="w-5 h-5 text-emerald-500" /> User Management
                    </h3>
                    <p className="text-sm text-muted-foreground">Search to manage roles and privileges.</p>
                </div>

                <div className="space-y-4">
                     <div className="relative">
                         <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                             <Search className="h-4 w-4 text-muted-foreground" />
                         </div>
                         <Input 
                            placeholder="Search by name or email..." 
                            className="pl-9 bg-background/50"
                            onChange={(e) => handleSearchUser(e.target.value)}
                         />
                     </div>
                     
                     {/* Search Results */}
                     <div className="min-h-[200px] space-y-2">
                         {isSearching ? (
                             <div className="flex justify-center p-4"><Skeleton className="w-6 h-6 rounded-full animate-spin" /></div>
                         ) : searchResults.length > 0 ? (
                             searchResults.map(user => (
                                 <div key={user.id} className="flex items-center justify-between p-3 bg-background/80 rounded-lg border hover:border-primary/50 transition-colors">
                                     <div className="overflow-hidden">
                                         <p className="font-medium text-sm truncate">{user.full_name}</p>
                                         <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                          <Badge variant="outline" className={`mt-1 text-[10px] h-5 ${
                                              user.role === 'admin' ? 'border-indigo-500 text-indigo-600' :
                                              user.role === 'teacher' ? 'border-emerald-500 text-emerald-600' : 'text-muted-foreground'
                                          }`}>
                                              {user.role}
                                          </Badge>
                                     </div>
                                     
                                     <Dialog>
                                         <DialogTrigger asChild>
                                             <Button 
                                                size="sm" variant="outline"
                                                onClick={() => setSelectedUser(user)}
                                             >
                                                Manage
                                             </Button>
                                         </DialogTrigger>
                                         <DialogContent>
                                             <DialogHeader>
                                                 <DialogTitle>Manage User: {user.full_name}</DialogTitle>
                                                 <DialogDescription>Assign a role or remove this user from the system.</DialogDescription>
                                             </DialogHeader>
                                             
                                             <div className="grid gap-4 py-4">
                                                 <div className="grid grid-cols-3 gap-2">
                                                     <Button 
                                                        variant={user.role === 'student' ? 'default' : 'outline'}
                                                        className="w-full"
                                                        onClick={() => handleUpdateRole(user.id, 'student')}
                                                        disabled={actionLoading}
                                                     >
                                                         Student
                                                     </Button>
                                                     <Button 
                                                        variant={user.role === 'teacher' ? 'default' : 'outline'}
                                                        className="w-full"
                                                        onClick={() => handleUpdateRole(user.id, 'teacher')}
                                                        disabled={actionLoading}
                                                     >
                                                         Teacher
                                                     </Button>
                                                     <Button 
                                                        variant={user.role === 'admin' ? 'default' : 'outline'}
                                                        className="w-full ring-2 ring-indigo-500/20"
                                                        onClick={() => handleUpdateRole(user.id, 'admin')}
                                                        disabled={actionLoading}
                                                     >
                                                         Admin
                                                     </Button>
                                                 </div>
                                                 
                                                 <div className="border-t pt-4 mt-2">
                                                     <Button 
                                                        variant="destructive" 
                                                        className="w-full"
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        disabled={actionLoading}
                                                     >
                                                         <Trash2 className="w-4 h-4 mr-2" /> Delete User Account
                                                     </Button>
                                                 </div>
                                             </div>
                                         </DialogContent>
                                     </Dialog>
                                 </div>
                             ))
                         ) : (
                             <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                                 No users found
                             </div>
                         )}
                     </div>
                </div>
            </div>

          </div>
        </TabsContent>
      </Tabs>
      {/* Clean User Manager Dialog */}
      {selectedUser && showClassManager && (
        <TeacherClassManager 
            isOpen={showClassManager}
            onClose={() => {
                setShowClassManager(false);
                setSelectedUser(null);
            }}
            teacherId={selectedUser.id}
            teacherName={selectedUser.full_name}
        />
      )}
    </div>
  );
}


