import { bootBrandLabel, type AppBootState } from "../../../appBoot";

export function AppBootFallback({ detail, title, variant }: AppBootState) {
  return (
    <div
      aria-label={title}
      aria-live="polite"
      className="app-boot-shell"
      data-app-boot={variant}
      role="status"
    >
      <div className="app-boot-card">
        <span className="app-boot-eyebrow">{bootBrandLabel}</span>
        <strong className="app-boot-title">{title}</strong>
        <span className="app-boot-detail">{detail}</span>
      </div>
    </div>
  );
}
