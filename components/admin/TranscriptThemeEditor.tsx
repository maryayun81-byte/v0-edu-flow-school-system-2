"use client";

import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, ChevronLeft, Save, RefreshCw, Palette, type LucideIcon } from "lucide-react";
import { toast } from "sonner"; // Assuming sonner is used, or use toast from ui/use-toast

interface Theme {
    id?: string;
    name: string;
    is_default: boolean;
    target_curriculum: string; // 'ALL', 'CBC', '8-4-4'
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        text: string;
        background: string;
    };
    fonts: {
        header: string;
        body: string;
        table: string;
    };
    layout: {
        header_style: string;
        table_style: string;
        footer_style: string;
        show_border: boolean;
        show_watermark: boolean;
    };
}

const defaultTheme: Theme = {
    name: "New Theme",
    is_default: false,
    target_curriculum: "ALL",
    colors: { primary: "#000000", secondary: "#666666", accent: "#000000", text: "#000000", background: "#ffffff" },
    fonts: { header: "Helvetica", body: "Helvetica", table: "Helvetica" },
    layout: { header_style: "modern", table_style: "lines", footer_style: "standard", show_border: true, show_watermark: true }
};

interface TranscriptThemeEditorProps {
    theme?: Theme | null;
    onSave: (theme: Theme) => Promise<void>;
    onCancel: () => void;
}

export default function TranscriptThemeEditor({ theme, onSave, onCancel }: TranscriptThemeEditorProps) {
    const [formData, setFormData] = useState<Theme>(theme ? { ...defaultTheme, ...theme } : defaultTheme);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("branding");

    // Live Preview Component
    const Preview = () => {
        const { colors, fonts, layout } = formData;
        
        const fontFamilyMap: Record<string, string> = {
            "Helvetica": "font-sans",
            "Arial": "font-sans",
            "Times": "font-serif",
            "Georgia": "font-serif",
            "Inter": "font-sans",
            "Playfair Display": "font-serif",
            "Merriweather": "font-serif",
            "Courier": "font-mono"
        };

        const headerFont = fontFamilyMap[fonts.header] || "font-sans";
        const bodyFont = fontFamilyMap[fonts.body] || "font-sans";

        return (
            <div 
                className={`w-full aspect-[1/1.414] shadow-2xl rounded-sm p-8 relative overflow-hidden transition-all duration-300`}
                style={{ backgroundColor: colors.background, color: colors.text }}
            >
                {/* Border */}
                {layout.show_border && (
                    <div className="absolute inset-4 border-2 pointer-events-none" style={{ borderColor: colors.primary }}></div>
                )}
                
                {/* Header */}
                <div className={`mb-8 ${layout.header_style === 'centered_logo' ? 'text-center' : 'flex justify-between items-center'}`}>
                     <div className={headerFont}>
                        <h1 className="text-2xl font-bold uppercase tracking-wider mb-2" style={{ color: colors.primary }}>School Name</h1>
                        <p className="text-xs uppercase tracking-widest opacity-70" style={{ color: colors.secondary }}>Excellence • Integrity • Knowledge</p>
                     </div>
                     {layout.header_style !== 'centered_logo' && (
                         <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-[10px] text-gray-400 border border-dashed">Logo</div>
                     )}
                </div>
                
                {/* Title Bar */}
                <div 
                    className="py-2 px-4 mb-6 flex justify-between items-center"
                    style={{ backgroundColor: layout.header_style === "flat_bar" ? colors.primary : `${colors.secondary}15` }}
                >
                    <span className={`uppercase font-bold tracking-widest text-sm ${layout.header_style === "flat_bar" ? "text-white" : ""}`} style={{ color: layout.header_style === "flat_bar" ? "#ffffff" : colors.primary }}>
                        Official Transcript
                    </span>
                    <span className="text-xs opacity-70">2024 / Term 1</span>
                </div>

                {/* Body Content */}
                <div className={`${bodyFont} space-y-4 mb-8 text-sm`}>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] uppercase opacity-60">Student Name</p>
                            <p className="font-bold">John Doe</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase opacity-60">Admission No</p>
                            <p className="font-bold">ADM-001</p>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="mb-8">
                     <div className="grid grid-cols-4 gap-2 border-b-2 pb-2 mb-2 font-bold text-xs uppercase" style={{ borderColor: colors.primary }}>
                         <div className="col-span-2">Subject</div>
                         <div className="text-center">Score</div>
                         <div className="text-center">Grade</div>
                     </div>
                     {[1, 2, 3].map((i) => (
                         <div 
                            key={i} 
                            className={`grid grid-cols-4 gap-2 py-2 text-sm border-b items-center ${layout.table_style === "shaded_rows" && i % 2 === 0 ? "bg-black/5" : ""}`}
                            style={{ borderColor: layout.table_style === "lines" ? `${colors.secondary}30` : "transparent" }}
                         >
                             <div className="col-span-2 font-medium">Mathematics</div>
                             <div className="text-center font-mono">8{i}</div>
                             <div className="text-center font-bold" style={{ color: colors.primary }}>A</div>
                         </div>
                     ))}
                </div>

                {/* Footer */}
                <div className="mt-auto pt-8 border-t" style={{ borderColor: `${colors.secondary}30` }}>
                    <div className="flex justify-between items-end">
                        <div className="text-center">
                            <div className="text-xs uppercase tracking-widest mb-4 font-bold">Principal's Signature</div>
                            <div className="h-8 border-b border-dashed w-32 mx-auto" style={{ borderColor: colors.primary }}></div>
                        </div>
                        {layout.footer_style === 'stamp_emphasis' && (
                            <div className="w-20 h-20 rounded-full border-4 opacity-20 flex items-center justify-center rotate-[-12deg]" style={{ borderColor: colors.accent }}>
                                <span className="uppercase text-[8px] font-bold text-center">Official<br/>Stamp</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const handleSave = async () => {
        if (!formData.name) return toast.error("Theme name is required");
        setSaving(true);
        try {
            await onSave(formData);
            toast.success("Theme saved successfully");
        } catch (e) {
            toast.error("Failed to save theme");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 h-auto lg:h-[calc(100vh-200px)]">
            {/* Editor Panel */}
            <div className="flex flex-col h-[600px] lg:h-full bg-card border rounded-xl shadow-sm overflow-hidden order-2 lg:order-1">
                <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                    <Button variant="ghost" size="sm" onClick={onCancel} className="gap-2">
                        <ChevronLeft className="w-4 h-4" /> Back
                    </Button>
                    <h2 className="font-semibold">Theme Editor</h2>
                    <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label>Theme Name</Label>
                            <Input 
                                value={formData.name} 
                                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                                placeholder="e.g., Midnight Blue"
                            />
                        </div>

                        <div className="space-y-2">
                             <Label>Target Curriculum</Label>
                             <Select 
                                value={formData.target_curriculum || "ALL"} 
                                onValueChange={(v) => setFormData({...formData, target_curriculum: v})}
                             >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Scope" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Global (All Curriculums)</SelectItem>
                                    <SelectItem value="CBC">CBC Only</SelectItem>
                                    <SelectItem value="8-4-4">8-4-4 Only</SelectItem>
                                </SelectContent>
                             </Select>
                             <p className="text-[10px] text-muted-foreground">
                                Specific curriculum themes override global defaults.
                             </p>
                        </div>
                        
                        <div className="flex items-center space-x-2 border p-3 rounded-lg bg-card mt-4">
                            <Switch 
                                checked={formData.is_default}
                                onCheckedChange={(c) => setFormData({...formData, is_default: c})}
                            />
                            <Label>Set as Default Theme</Label>
                        </div>

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="w-full grid grid-cols-3">
                                <TabsTrigger value="branding">Colors</TabsTrigger>
                                <TabsTrigger value="typography">Typography</TabsTrigger>
                                <TabsTrigger value="layout">Layout</TabsTrigger>
                            </TabsList>
                            
                            {/* COLORS TAB */}
                            <TabsContent value="branding" className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Primary Color</Label>
                                        <div className="flex gap-2">
                                            <Input type="color" className="w-12 h-10 p-1" value={formData.colors.primary} onChange={(e) => setFormData({...formData, colors: { ...formData.colors, primary: e.target.value }})} />
                                            <Input value={formData.colors.primary} onChange={(e) => setFormData({...formData, colors: { ...formData.colors, primary: e.target.value }})} className="uppercase" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Secondary Color</Label>
                                        <div className="flex gap-2">
                                            <Input type="color" className="w-12 h-10 p-1" value={formData.colors.secondary} onChange={(e) => setFormData({...formData, colors: { ...formData.colors, secondary: e.target.value }})} />
                                            <Input value={formData.colors.secondary} onChange={(e) => setFormData({...formData, colors: { ...formData.colors, secondary: e.target.value }})} className="uppercase" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Accent Color</Label>
                                        <div className="flex gap-2">
                                            <Input type="color" className="w-12 h-10 p-1" value={formData.colors.accent} onChange={(e) => setFormData({...formData, colors: { ...formData.colors, accent: e.target.value }})} />
                                            <Input value={formData.colors.accent} onChange={(e) => setFormData({...formData, colors: { ...formData.colors, accent: e.target.value }})} className="uppercase" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Background</Label>
                                        <div className="flex gap-2">
                                             <Input type="color" className="w-12 h-10 p-1" value={formData.colors.background} onChange={(e) => setFormData({...formData, colors: { ...formData.colors, background: e.target.value }})} />
                                             <Select value={formData.colors.background} onValueChange={(v) => setFormData({...formData, colors: { ...formData.colors, background: v }})}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="#ffffff">White</SelectItem>
                                                    <SelectItem value="#FAFAFA">Off-White</SelectItem>
                                                    <SelectItem value="#FFFDF8">Cream</SelectItem>
                                                    <SelectItem value="#F0F9FF">Soft Blue Tint</SelectItem>
                                                </SelectContent>
                                             </Select>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* TYPOGRAPHY TAB */}
                            <TabsContent value="typography" className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Header Font</Label>
                                    <Select value={formData.fonts.header} onValueChange={(v) => setFormData({...formData, fonts: { ...formData.fonts, header: v }})}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Helvetica">Helvetica (Clean)</SelectItem>
                                            <SelectItem value="Arial">Arial (Standard)</SelectItem>
                                            <SelectItem value="Inter">Inter (Modern)</SelectItem>
                                            <SelectItem value="Times">Times New Roman (Classic)</SelectItem>
                                            <SelectItem value="Georgia">Georgia (Elegant)</SelectItem>
                                            <SelectItem value="Playfair Display">Playfair Display (Premium)</SelectItem>
                                            <SelectItem value="Merriweather">Merriweather (Academic)</SelectItem>
                                            <SelectItem value="Cinzel">Cinzel (Ceremonial)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Body Font</Label>
                                    <Select value={formData.fonts.body} onValueChange={(v) => setFormData({...formData, fonts: { ...formData.fonts, body: v }})}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Helvetica">Helvetica</SelectItem>
                                            <SelectItem value="Arial">Arial</SelectItem>
                                            <SelectItem value="Inter">Inter</SelectItem>
                                            <SelectItem value="Georgia">Georgia</SelectItem>
                                            <SelectItem value="Courier">Courier (Typewriter)</SelectItem>
                                            <SelectItem value="Lora">Lora</SelectItem>
                                            <SelectItem value="IBM Plex Sans">IBM Plex Sans</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TabsContent>

                            {/* LAYOUT TAB */}
                            <TabsContent value="layout" className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Header Style</Label>
                                    <Select value={formData.layout.header_style} onValueChange={(v) => setFormData({...formData, layout: { ...formData.layout, header_style: v }})}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="modern">Modern (Standard)</SelectItem>
                                            <SelectItem value="centered_logo">Classic (Centered Logo)</SelectItem>
                                            <SelectItem value="flat_bar">Institutional (Flat Bar)</SelectItem>
                                            <SelectItem value="minimal">Minimal (Typography Focus)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Table Style</Label>
                                    <Select value={formData.layout.table_style} onValueChange={(v) => setFormData({...formData, layout: { ...formData.layout, table_style: v }})}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="lines">Simple Lines</SelectItem>
                                            <SelectItem value="grid">Grid Borders</SelectItem>
                                            <SelectItem value="shaded_rows">Shaded Rows</SelectItem>
                                            <SelectItem value="cards">Modern Cards</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Show Formal Border</Label>
                                        <Switch checked={formData.layout.show_border} onCheckedChange={(c) => setFormData({...formData, layout: { ...formData.layout, show_border: c }})} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label>Show Watermark</Label>
                                        <Switch checked={formData.layout.show_watermark} onCheckedChange={(c) => setFormData({...formData, layout: { ...formData.layout, show_watermark: c }})} />
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>

            {/* Preview Panel */}
            <div className="flex flex-col h-full">
                <div className="p-4 border-b bg-muted/30">
                     <h2 className="font-semibold text-muted-foreground flex items-center gap-2">
                        <Palette className="w-4 h-4" /> Live PDF Preview
                     </h2>
                </div>
                <div className="flex-1 bg-neutral-100 p-8 flex items-center justify-center overflow-auto rounded-xl border border-dashed m-1">
                    <Preview />
                </div>
                <div className="p-4 text-center text-xs text-muted-foreground">
                    This is a visual approximation. Actual PDF download requires high-resolution generation.
                </div>
            </div>
        </div>
    );
}
