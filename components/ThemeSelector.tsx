"use client";

import React from "react"

import { useState } from "react";
import { useTheme, THEMES, type ThemeType } from "@/contexts/ThemeContext";
import {
  Sun,
  Moon,
  Flower2,
  Waves,
  Leaf,
  Sparkles,
  Sunrise,
  Check,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  sun: Sun,
  moon: Moon,
  flower: Flower2,
  waves: Waves,
  leaf: Leaf,
  sparkles: Sparkles,
  sunrise: Sunrise,
};

interface ThemeSelectorProps {
  variant?: "button" | "inline";
  onThemeChange?: (theme: ThemeType) => void;
}

export default function ThemeSelector({
  variant = "button",
  onThemeChange,
}: ThemeSelectorProps) {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);

  const handleThemeChange = (newTheme: ThemeType) => {
    setTheme(newTheme);
    onThemeChange?.(newTheme);
    if (variant === "button") {
      setOpen(false);
    }
  };

  const currentTheme = themes.find((t) => t.id === theme);

  if (variant === "inline") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Palette className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Theme</h3>
            <p className="text-sm text-muted-foreground">
              Choose your preferred appearance
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {themes.map((t) => {
            const Icon = iconMap[t.icon] || Sun;
            const isSelected = theme === t.id;

            return (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
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
                <div className="flex gap-1 mb-3">
                  <div
                    className="w-5 h-5 rounded-full border border-border/30"
                    style={{ backgroundColor: t.preview.bg }}
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-border/30"
                    style={{ backgroundColor: t.preview.card }}
                  />
                  <div
                    className="w-5 h-5 rounded-full"
                    style={{ backgroundColor: t.preview.primary }}
                  />
                  <div
                    className="w-5 h-5 rounded-full"
                    style={{ backgroundColor: t.preview.accent }}
                  />
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm text-foreground">
                    {t.name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {t.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const CurrentIcon = currentTheme ? iconMap[currentTheme.icon] || Sun : Sun;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-border/50 bg-transparent hover:bg-card"
        >
          <CurrentIcon className="w-4 h-4" />
          <span className="hidden sm:inline">{currentTheme?.name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Choose Theme
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-4">
          {themes.map((t) => {
            const Icon = iconMap[t.icon] || Sun;
            const isSelected = theme === t.id;

            return (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
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
                <div className="flex gap-1 mb-3">
                  <div
                    className="w-5 h-5 rounded-full border border-border/30"
                    style={{ backgroundColor: t.preview.bg }}
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-border/30"
                    style={{ backgroundColor: t.preview.card }}
                  />
                  <div
                    className="w-5 h-5 rounded-full"
                    style={{ backgroundColor: t.preview.primary }}
                  />
                  <div
                    className="w-5 h-5 rounded-full"
                    style={{ backgroundColor: t.preview.accent }}
                  />
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm text-foreground">
                    {t.name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {t.description}
                </p>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
