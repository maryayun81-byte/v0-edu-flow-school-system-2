"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ThemeType = "light" | "dark" | "sakura" | "ocean" | "forest" | "nebula" | "sunset" | "arctic" | "copper" | "midnight" | "lavender";

export interface Theme {
  id: ThemeType;
  name: string;
  description: string;
  icon: string;
  preview: {
    bg: string;
    card: string;
    primary: string;
    accent: string;
  };
}

export const THEMES: Theme[] = [
  {
    id: "light",
    name: "Light",
    description: "Clean and bright for daytime use",
    icon: "sun",
    preview: {
      bg: "#fafafa",
      card: "#ffffff",
      primary: "#6366f1",
      accent: "#10b981",
    },
  },
  {
    id: "dark",
    name: "Dark",
    description: "Easy on the eyes, great for night study",
    icon: "moon",
    preview: {
      bg: "#1a1a2e",
      card: "#252540",
      primary: "#818cf8",
      accent: "#34d399",
    },
  },
  {
    id: "sakura",
    name: "Sakura Bloom",
    description: "Soft pinks, whites, and rose gold",
    icon: "flower",
    preview: {
      bg: "#fdf2f4",
      card: "#ffffff",
      primary: "#f472b6",
      accent: "#fb923c",
    },
  },
  {
    id: "ocean",
    name: "Deep Ocean",
    description: "Navy blues, slate grays, and neon cyan",
    icon: "waves",
    preview: {
      bg: "#0f172a",
      card: "#1e293b",
      primary: "#38bdf8",
      accent: "#22d3ee",
    },
  },
  {
    id: "forest",
    name: "Emerald Forest",
    description: "Sage greens and earthy browns for calm studying",
    icon: "leaf",
    preview: {
      bg: "#f0fdf4",
      card: "#ffffff",
      primary: "#22c55e",
      accent: "#a3a042",
    },
  },
  {
    id: "nebula",
    name: "Midnight Nebula",
    description: "Deep purples, charcoal, and electric violet",
    icon: "sparkles",
    preview: {
      bg: "#1a0a2e",
      card: "#2d1b4e",
      primary: "#a855f7",
      accent: "#e879f9",
    },
  },
  {
    id: "sunset",
    name: "Sunset Gold",
    description: "Warm oranges and soft yellows for energy",
    icon: "sunrise",
    preview: {
      bg: "#fffbeb",
      card: "#ffffff",
      primary: "#f59e0b",
      accent: "#fbbf24",
    },
  },
  {
    id: "arctic",
    name: "Arctic Frost",
    description: "Cool whites, icy blues, and silver accents",
    icon: "snowflake",
    preview: {
      bg: "#f8fafc",
      card: "#ffffff",
      primary: "#0ea5e9",
      accent: "#94a3b8",
    },
  },
  {
    id: "copper",
    name: "Copper Rose",
    description: "Warm copper tones with rose gold highlights",
    icon: "flame",
    preview: {
      bg: "#1c1917",
      card: "#292524",
      primary: "#ea580c",
      accent: "#f97316",
    },
  },
  {
    id: "midnight",
    name: "Midnight Blue",
    description: "Deep blue with starlight accents",
    icon: "stars",
    preview: {
      bg: "#0c1929",
      card: "#172a46",
      primary: "#3b82f6",
      accent: "#60a5fa",
    },
  },
  {
    id: "lavender",
    name: "Lavender Dream",
    description: "Soft purples and gentle pastels for relaxation",
    icon: "cloud",
    preview: {
      bg: "#faf5ff",
      card: "#ffffff",
      primary: "#9333ea",
      accent: "#c084fc",
    },
  },
];

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>("dark");
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("eduflow-theme") as ThemeType;
    if (savedTheme && THEMES.some((t) => t.id === savedTheme)) {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  const applyTheme = useCallback((newTheme: ThemeType) => {
    // Remove all theme classes
    document.documentElement.classList.remove(
      "theme-light",
      "theme-dark",
      "theme-sakura",
      "theme-ocean",
      "theme-forest",
      "theme-nebula",
      "theme-sunset",
      "theme-arctic",
      "theme-copper",
      "theme-midnight",
      "theme-lavender"
    );
    // Add new theme class
    document.documentElement.classList.add(`theme-${newTheme}`);
  }, []);

  const setTheme = useCallback(
    (newTheme: ThemeType) => {
      setThemeState(newTheme);
      localStorage.setItem("eduflow-theme", newTheme);
      applyTheme(newTheme);
    },
    [applyTheme]
  );

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
