"use client";

import { ThemeProvider as NextThemeProvider, useTheme as useNextTheme } from "next-themes";
import { createContext, type ReactNode, useContext, useMemo } from "react";

export type Theme = "light" | "dark" | "dim" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function normalizeTheme(theme: string | undefined): Theme {
  if (theme === "light" || theme === "dark" || theme === "dim" || theme === "system") {
    return theme;
  }
  return "system";
}

export function normalizeResolvedTheme(theme: string | undefined): "light" | "dark" {
  return theme === "dark" || theme === "dim" ? "dark" : "light";
}

function ThemeBridge({ children }: { children: ReactNode }) {
  const { theme, resolvedTheme, setTheme } = useNextTheme();

  const value = useMemo<ThemeContextType>(
    () => ({
      theme: normalizeTheme(theme),
      resolvedTheme: normalizeResolvedTheme(resolvedTheme),
      setTheme: (nextTheme) => {
        setTheme(nextTheme);
      },
    }),
    [resolvedTheme, setTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      themes={["dark", "dim", "light"]}
    >
      <ThemeBridge>{children}</ThemeBridge>
    </NextThemeProvider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
