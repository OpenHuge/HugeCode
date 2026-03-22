export const bootBrandLabel = "HugeCode";

export type AppBootVariant = "about" | "workspace";

export type AppBootState = {
  detail: string;
  title: string;
  variant: AppBootVariant;
};

export const aboutBootState = {
  variant: "about",
  title: "Loading about view",
  detail: "Preparing product details and release metadata.",
} as const satisfies AppBootState;

export const workspaceBootState = {
  variant: "workspace",
  title: "Launching workspace",
  detail: "Loading the workspace shell and runtime services.",
} as const satisfies AppBootState;
