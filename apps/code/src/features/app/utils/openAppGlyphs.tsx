import { type ReactNode, type SVGProps, useId } from "react";
import type { OpenAppTarget } from "../../../types";
import { resolveOpenAppIcon } from "./openAppIcons";

type GlyphProps = SVGProps<SVGSVGElement>;

function CursorGlyph(props: GlyphProps) {
  return (
    <svg {...props} viewBox="0 0 466.73 532.09" fill="currentColor">
      <path d="M457.43,125.94L244.42,2.96c-6.84-3.95-15.28-3.95-22.12,0L9.3,125.94c-5.75,3.32-9.3,9.46-9.3,16.11v247.99c0,6.65,3.55,12.79,9.3,16.11l213.01,122.98c6.84,3.95,15.28,3.95,22.12,0l213.01-122.98c5.75-3.32,9.3-9.46,9.3-16.11v-247.99c0-6.65-3.55-12.79-9.3-16.11h-.01ZM444.05,151.99l-205.63,356.16c-1.39,2.4-5.06,1.42-5.06-1.36v-233.21c0-4.66-2.49-8.97-6.53-11.31L24.87,145.67c-2.4-1.39-1.42-5.06,1.36-5.06h411.26c5.84,0,9.49,6.33,6.57,11.39h-.01Z" />
    </svg>
  );
}

function VsCodeGlyph(props: GlyphProps) {
  const id = useId();
  const maskId = `${id}-mask`;
  const gradientId = `${id}-gradient`;

  return (
    <svg {...props} fill="none" viewBox="0 0 100 100">
      <mask id={maskId} width="100" height="100" x="0" y="0" maskUnits="userSpaceOnUse">
        <path
          fill="#fff"
          fillRule="evenodd"
          d="M70.912 99.317a6.223 6.223 0 0 0 4.96-.19l20.589-9.907A6.25 6.25 0 0 0 100 83.587V16.413a6.25 6.25 0 0 0-3.54-5.632L75.874.874a6.226 6.226 0 0 0-7.104 1.21L29.355 38.04 12.187 25.01a4.162 4.162 0 0 0-5.318.236l-5.506 5.009a4.168 4.168 0 0 0-.004 6.162L16.247 50 1.36 63.583a4.168 4.168 0 0 0 .004 6.162l5.506 5.01a4.162 4.162 0 0 0 5.318.236l17.168-13.032L68.77 97.917a6.217 6.217 0 0 0 2.143 1.4ZM75.015 27.3 45.11 50l29.906 22.701V27.3Z"
          clipRule="evenodd"
        />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path
          fill="#0065A9"
          d="M96.461 10.796 75.857.876a6.23 6.23 0 0 0-7.107 1.207l-67.451 61.5a4.167 4.167 0 0 0 .004 6.162l5.51 5.009a4.167 4.167 0 0 0 5.32.236l81.228-61.62c2.725-2.067 6.639-.124 6.639 3.297v-.24a6.25 6.25 0 0 0-3.539-5.63Z"
        />
        <path
          fill="#007ACC"
          d="m96.461 89.204-20.604 9.92a6.229 6.229 0 0 1-7.107-1.207l-67.451-61.5a4.167 4.167 0 0 1 .004-6.162l5.51-5.009a4.167 4.167 0 0 1 5.32-.236l81.228 61.62c2.725 2.067 6.639.124 6.639-3.297v.24a6.25 6.25 0 0 1-3.539 5.63Z"
        />
        <path
          fill="#1F9CF0"
          d="M75.858 99.126a6.232 6.232 0 0 1-7.108-1.21c2.306 2.307 6.25.674 6.25-2.588V4.672c0-3.262-3.944-4.895-6.25-2.589a6.232 6.232 0 0 1 7.108-1.21l20.6 9.908A6.25 6.25 0 0 1 100 16.413v67.174a6.25 6.25 0 0 1-3.541 5.633l-20.601 9.906Z"
        />
        <path
          fill={`url(#${gradientId})`}
          fillRule="evenodd"
          d="M70.851 99.317a6.224 6.224 0 0 0 4.96-.19L96.4 89.22a6.25 6.25 0 0 0 3.54-5.633V16.413a6.25 6.25 0 0 0-3.54-5.632L75.812.874a6.226 6.226 0 0 0-7.104 1.21L29.294 38.04 12.126 25.01a4.162 4.162 0 0 0-5.317.236l-5.507 5.009a4.168 4.168 0 0 0-.004 6.162L16.186 50 1.298 63.583a4.168 4.168 0 0 0 .004 6.162l5.507 5.009a4.162 4.162 0 0 0 5.317.236L29.294 61.96l39.414 35.958a6.218 6.218 0 0 0 2.143 1.4ZM74.954 27.3 45.048 50l29.906 22.701V27.3Z"
          clipRule="evenodd"
          opacity=".18"
        />
      </g>
      <defs>
        <linearGradient
          id={gradientId}
          x1="50"
          x2="50"
          y1="0"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ZedGlyph(props: GlyphProps) {
  return (
    <svg {...props} fill="none" viewBox="0 0 96 96">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M9 6a3 3 0 0 0-3 3v66H0V9a9 9 0 0 1 9-9h80.379c4.009 0 6.016 4.847 3.182 7.682L43.055 57.187H57V51h6v7.688a4.5 4.5 0 0 1-4.5 4.5H37.055L26.743 73.5H73.5V36h6v37.5a6 6 0 0 1-6 6H20.743L10.243 90H87a3 3 0 0 0 3-3V21h6v66a9 9 0 0 1-9 9H6.621c-4.009 0-6.016-4.847-3.182-7.682L52.757 39H39v6h-6v-7.5a4.5 4.5 0 0 1 4.5-4.5h21.257l10.5-10.5H22.5V60h-6V22.5a6 6 0 0 1 6-6h52.757L85.757 6H9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function GhosttyGlyph(props: GlyphProps) {
  const id = useId();
  const gradientId = `${id}-ghostty-surface`;

  return (
    <svg {...props} viewBox="0 0 96 96" fill="none">
      <rect x="8" y="10" width="80" height="76" rx="18" fill="#111318" />
      <rect x="12" y="14" width="72" height="68" rx="14" fill={`url(#${gradientId})`} />
      <path
        d="M29 33.5 43 47 29 60.5"
        stroke="#F5F7FB"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M49 61h18" stroke="#6AA8FF" strokeWidth="8" strokeLinecap="round" />
      <defs>
        <linearGradient
          id={gradientId}
          x1="48"
          x2="48"
          y1="14"
          y2="82"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#1B2030" />
          <stop offset="1" stopColor="#0E1118" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ExplorerGlyph(props: GlyphProps) {
  return (
    <svg {...props} viewBox="0 0 96 96" fill="none">
      <path d="M14 28a8 8 0 0 1 8-8h18l7 8h27a8 8 0 0 1 8 8v8H14v-16Z" fill="#F4C44D" />
      <path d="M14 40h68v24a12 12 0 0 1-12 12H26a12 12 0 0 1-12-12V40Z" fill="#E8AE2B" />
      <path
        d="M14 41.5c0-4.142 3.358-7.5 7.5-7.5h54.454c4.876 0 8.367 4.705 6.944 9.37l-4.39 14.39A12 12 0 0 1 67.03 66H21.5c-4.142 0-7.5-3.358-7.5-7.5v-17Z"
        fill="#FFD86A"
      />
    </svg>
  );
}

function AntigravityGlyph(props: GlyphProps) {
  const id = useId();
  const gradientId = `${id}-antigravity-arc`;

  return (
    <svg {...props} viewBox="0 0 96 96" fill="none">
      <rect x="10" y="10" width="76" height="76" rx="18" fill="#15171D" />
      <path
        d="M23 67c10.5-28 19-42 25.5-42S64 39 73 67"
        stroke={`url(#${gradientId})`}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path d="M48 31v38" stroke="#EAF2FF" strokeWidth="7" strokeLinecap="round" />
      <defs>
        <linearGradient
          id={gradientId}
          x1="23"
          x2="73"
          y1="67"
          y2="67"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#39C2FF" />
          <stop offset=".48" stopColor="#FFB648" />
          <stop offset="1" stopColor="#7CFF88" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const KNOWN_OPEN_APP_GLYPHS: Record<string, (props: GlyphProps) => ReactNode> = {
  antigravity: AntigravityGlyph,
  cursor: CursorGlyph,
  finder: ExplorerGlyph,
  ghostty: GhosttyGlyph,
  vscode: VsCodeGlyph,
  zed: ZedGlyph,
};

export function resolveOpenAppGlyph(
  target: Pick<OpenAppTarget, "id" | "kind">,
  options: {
    className?: string;
    iconById?: Record<string, string>;
  } = {}
): ReactNode {
  const glyphId = target.kind === "finder" ? "finder" : target.id;
  const KnownGlyph = KNOWN_OPEN_APP_GLYPHS[glyphId];

  if (KnownGlyph) {
    return <KnownGlyph className={options.className} aria-hidden data-open-app-icon={glyphId} />;
  }

  return (
    <img
      className={options.className}
      src={resolveOpenAppIcon(target, options.iconById)}
      alt=""
      aria-hidden
      data-open-app-icon={glyphId}
    />
  );
}
