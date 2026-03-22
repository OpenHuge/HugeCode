function roundNumber(value, digits = 4) {
  return Number.parseFloat(value.toFixed(digits));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeNodeId(value) {
  return String(value ?? "").replace(/-/gu, ":");
}

export function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64);
}

export function toHex(color) {
  if (!color || typeof color !== "object") {
    return null;
  }

  const channels = [color.r, color.g, color.b].map((channel) => {
    if (typeof channel !== "number" || Number.isNaN(channel)) {
      return 0;
    }
    return Math.max(0, Math.min(255, Math.round(channel * 255)));
  });

  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function toRgbaString(color, opacity = 1) {
  if (!color || typeof color !== "object") {
    return null;
  }

  const red = Math.max(0, Math.min(255, Math.round((color.r ?? 0) * 255)));
  const green = Math.max(0, Math.min(255, Math.round((color.g ?? 0) * 255)));
  const blue = Math.max(0, Math.min(255, Math.round((color.b ?? 0) * 255)));
  const alpha = roundNumber(clamp01(opacity), 3);

  if (alpha >= 1) {
    return `rgb(${red} ${green} ${blue})`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function valueFrequencyMap(entries) {
  const frequency = new Map();
  for (const entry of entries) {
    frequency.set(entry, (frequency.get(entry) ?? 0) + 1);
  }
  return frequency;
}

export function rankedEntriesFromFrequencyMap(frequencyMap) {
  return [...frequencyMap.entries()]
    .sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])))
    .map(([value, count]) => ({ value, count }));
}

export function stableSignature(parts) {
  return parts
    .filter((value) => value !== null && value !== undefined && String(value).length > 0)
    .join("|");
}
