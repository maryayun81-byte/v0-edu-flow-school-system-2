"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, CheckCircle, Palette } from "lucide-react";
import { toast } from "sonner";
import TranscriptThemeEditor from "./TranscriptThemeEditor";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface Theme {
    id: string;
    name: string;
    is_default: boolean;
    target_curriculum: string;
    colors: any;
    fonts: any;
    layout: any;
}

export default function TranscriptThemeManager() {
    const [themes, setThemes] = useState<Theme[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingTheme, setEditingTheme] = useState<Theme | null | "new">(null);

    useEffect(() => {
        fetchThemes();
    }, []);

    async function fetchThemes() {
        setLoading(true);
        try {
            // Get session for robust auth
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            console.log("Client Debug: Session found?", !!session);
            console.log("Client Debug: Session Error?", sessionError);

            const headers: any = {};
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            } else {
                console.warn("Client Debug: No access token available!");
            }

            const res = await fetch("/api/admin/transcript-themes", { headers });
            
            if (res.status === 401) {
                // If still 401, session might be invalid.
                toast.error("Session expired. Please reload.");
                return;
            }
            
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            setThemes(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load themes");
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveTheme(themeData: any) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: any = { "Content-Type": "application/json" };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const url = themeData.id 
                ? `/api/admin/transcript-themes/${themeData.id}`
                : `/api/admin/transcript-themes`;
            
            const method = themeData.id ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(themeData)
            });

            if (!res.ok) throw new Error("Save failed");
            
            toast.success("Theme saved successfully");
            setEditingTheme(null);
            fetchThemes();
        } catch (error) {
            console.error(error);
            toast.error("Failed to save theme");
            throw error; // Let Editor handle it
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this theme?")) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: any = {};
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const res = await fetch(`/api/admin/transcript-themes/${id}`, { 
                method: "DELETE",
                headers
            });
            if (!res.ok) throw new Error("Delete failed");
            toast.success("Theme deleted");
            fetchThemes();
        } catch (error) {
            toast.error("Failed to delete theme");
        }
    }

    if (editingTheme) {
        return (
            <TranscriptThemeEditor 
                theme={editingTheme === "new" ? null : editingTheme}
                onSave={handleSaveTheme}
                onCancel={() => setEditingTheme(null)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                     <h2 className="text-2xl font-bold tracking-tight">Transcript Themes</h2>
                     <p className="text-muted-foreground">Manage visual styles for official transcript PDFs.</p>
                </div>
                <Button onClick={() => setEditingTheme("new")} className="gap-2 w-full sm:w-auto">
                    <Plus className="w-4 h-4" /> Create New Theme
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {themes.map((theme) => (
                    <Card key={theme.id} className="relative group hover:shadow-lg transition-all border-l-4" style={{ borderLeftColor: theme.colors.primary }}>
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-start gap-2">
                                <CardTitle className="text-lg font-bold leading-tight">{theme.name}</CardTitle>
                                <div className="flex flex-col items-end gap-1">
                                     {theme.is_default && (
                                         <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 hover:bg-green-100 whitespace-nowrap border-green-200">
                                             <CheckCircle className="w-3 h-3" /> Active ({theme.target_curriculum === 'ALL' ? 'Global' : theme.target_curriculum})
                                         </Badge>
                                     )}
                                     <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                                         {theme.target_curriculum === 'ALL' ? 'Global Scope' : `${theme.target_curriculum} Only`}
                                     </Badge>
                                </div>
                            </div>
                            <CardDescription className="flex items-center gap-2 text-xs">
                                <span className="w-3 h-3 rounded-full border shadow-sm" style={{ background: theme.colors.primary }} />
                                <span className="w-3 h-3 rounded-full border shadow-sm" style={{ background: theme.colors.secondary }} />
                                <span className="w-3 h-3 rounded-full border shadow-sm" style={{ background: theme.colors.accent }} />
                                <span className="ml-2">{theme.layout.header_style.replace('_', ' ')}</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="w-full h-24 bg-muted/20 rounded-md border border-dashed flex items-center justify-center mb-4 overflow-hidden relative">
                                 {/* Mini Preview Abstract */}
                                 <div className="absolute inset-2 bg-white shadow-sm flex flex-col p-2 gap-1 text-[6px] opacity-70 pointer-events-none" style={{ fontFamily: theme.fonts.header }}>
                                     <div className="w-1/2 h-1 mb-1" style={{ background: theme.colors.primary }}></div>
                                     <div className="w-full h-px bg-gray-200"></div>
                                     <div className="w-full h-px bg-gray-200"></div>
                                 </div>
                             </div>

                             <div className="flex items-center gap-2">
                                 <Button variant="outline" size="sm" onClick={() => setEditingTheme(theme)} className="gap-2">
                                     <Edit2 className="w-3 h-3" /> Edit
                                 </Button>
                                 {!theme.is_default && (
                                     <>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => handleSaveTheme({ ...theme, is_default: true })}
                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-2"
                                            title={`Set as Active for ${theme.target_curriculum === 'ALL' ? 'Global' : theme.target_curriculum}`}
                                        >
                                            <CheckCircle className="w-4 h-4" /> Set Active
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(theme.id)} className="text-red-500 hover:bg-red-50 hover:text-red-700 px-2">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                     </>
                                 )}
                             </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            
            {themes.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                    <Palette className="w-10 h-10 mx-auto mb-4 opacity-50" />
                    <p>No themes found. Create one or run the seed script.</p>
                </div>
            )}
            
            {/* Auth Recovery UI */}
            {themes.length === 0 && !loading && (
                 <div className="mt-4 text-center">
                    <Button variant="link" onClick={fetchThemes} className="text-xs text-muted-foreground">
                        Retry Connection
                    </Button>
                 </div>
            )}
        </div>
    );
}
