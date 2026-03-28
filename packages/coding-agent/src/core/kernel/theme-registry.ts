import type { ThemeDefinition, ThemeRegistry } from "./contracts.js";

class InMemoryThemeRegistry implements ThemeRegistry {
  private discoveredThemes = new Map<string, ThemeDefinition>();
  private runtimeThemes = new Map<string, ThemeDefinition>();
  private activeThemeName?: string;

  setDiscoveredThemes(themes: ThemeDefinition[]): void {
    this.discoveredThemes = new Map(themes.map((theme) => [theme.name, theme]));
    if (this.activeThemeName && !this.getTheme(this.activeThemeName)) {
      this.activeThemeName = undefined;
    }
  }

  registerRuntimeTheme(theme: ThemeDefinition): void {
    this.runtimeThemes.set(theme.name, theme);
  }

  resetRuntimeThemes(): void {
    this.runtimeThemes.clear();
    if (this.activeThemeName && !this.getTheme(this.activeThemeName)) {
      this.activeThemeName = undefined;
    }
  }

  getTheme(name: string): ThemeDefinition | undefined {
    return this.runtimeThemes.get(name) ?? this.discoveredThemes.get(name);
  }

  getAllThemes(): ThemeDefinition[] {
    return [...this.discoveredThemes.values(), ...this.runtimeThemes.values()];
  }

  applyTheme(name: string): ThemeDefinition | undefined {
    const theme = this.getTheme(name);
    if (!theme) {
      return undefined;
    }

    this.activeThemeName = theme.name;
    return theme;
  }

  getActiveTheme(): ThemeDefinition | undefined {
    return this.activeThemeName ? this.getTheme(this.activeThemeName) : undefined;
  }
}

export function createThemeRegistry(): ThemeRegistry {
  return new InMemoryThemeRegistry();
}
