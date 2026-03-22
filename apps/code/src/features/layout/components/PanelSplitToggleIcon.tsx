type PanelSplitToggleIconProps = {
  side: "left" | "right";
  active?: boolean;
  title?: string;
  className?: string;
};

export function PanelSplitToggleIcon({
  side,
  active = false,
  title = "Panel toggle",
  className,
}: PanelSplitToggleIconProps) {
  const fillX = side === "left" ? 2.5 : 9.9;

  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      aria-hidden
      className={className}
      data-panel-split-side={side}
    >
      <title>{title}</title>
      <rect
        x="1.6"
        y="1.6"
        width="16.8"
        height="16.8"
        rx="3.8"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M10 3.4v13.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={0.92}
      />
      {active && (
        <rect
          x={fillX}
          y="2.4"
          width="7.6"
          height="15.2"
          rx="1.7"
          fill="currentColor"
          opacity={0.22}
        />
      )}
    </svg>
  );
}
