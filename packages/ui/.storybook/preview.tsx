import type { Decorator, Preview } from "@storybook/react";
import { useEffect, type ReactNode } from "react";
import { ThemeProvider, useTheme, type Theme } from "../src/providers/ThemeProvider";
import "../src/styles/globals";

function ThemeBridge({ children, theme }: { children: ReactNode; theme: Theme }) {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(theme);
    document.documentElement.setAttribute("data-theme", theme === "system" ? "dark" : theme);
  }, [setTheme, theme]);

  return children;
}

const withThemeProvider: Decorator = (Story, context) => {
  const theme = (context.globals.theme ?? "dark") as Theme;

  return (
    <ThemeProvider>
      <ThemeBridge theme={theme}>
        <Story />
      </ThemeBridge>
    </ThemeProvider>
  );
};

const preview = {
  decorators: [withThemeProvider],
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Shared design-system theme",
      defaultValue: "dark",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "dark", title: "Dark" },
          { value: "dim", title: "Dim" },
          { value: "light", title: "Light" },
        ],
      },
    },
  },
  parameters: {
    backgrounds: {
      disable: true,
    },
    controls: {
      expanded: true,
    },
    layout: "padded",
    options: {
      storySort: {
        method: "alphabetical",
      },
    },
  },
} satisfies Preview;

export default preview;
