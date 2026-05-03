// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clipboardWriteText = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@ku0/design-system", () => ({
  Button: ({
    children,
    disabled,
    onClick,
    type = "button",
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    type?: "button" | "submit" | "reset";
  }) => (
    <button disabled={disabled} onClick={onClick} type={type}>
      {children}
    </button>
  ),
  Input: ({
    id,
    onValueChange,
    placeholder,
    value,
  }: {
    id?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    value: string;
  }) => (
    <input
      id={id}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    />
  ),
  Select: ({
    ariaLabel,
    onValueChange,
    options,
    value,
  }: {
    ariaLabel: string;
    onValueChange?: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    value: string;
  }) => (
    <label>
      <span>{ariaLabel}</span>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
  Textarea: ({
    onChange,
    readOnly,
    value,
  }: {
    onChange?: (event: { target: { value: string } }) => void;
    readOnly?: boolean;
    value: string;
  }) => (
    <textarea
      readOnly={readOnly}
      value={value}
      onChange={(event) => onChange?.({ target: { value: event.target.value } })}
    />
  ),
}));

import { SettingsRelayAssistantSection } from "./SettingsRelayAssistantSection";

describe("SettingsRelayAssistantSection", () => {
  beforeEach(() => {
    clipboardWriteText.mockClear();
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
  });

  it("switches relay presets and copies runtime plus Codex shell config", async () => {
    render(<SettingsRelayAssistantSection />);

    fireEvent.change(screen.getByLabelText("Relay type"), {
      target: { value: "one-api" },
    });

    expect(screen.getByDisplayValue("https://one-api.example.com/v1")).toBeTruthy();
    expect(screen.getByText(/Runtime provider: relay_one_api/)).toBeTruthy();
    expect(screen.getByText(/Quality plugin: relay_one_api_relay_quality/)).toBeTruthy();
    expect(screen.getByDisplayValue(/model_provider = "relay_one_api"/)).toBeTruthy();
    expect(screen.getByDisplayValue(/relay_one_api_relay_quality/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Copy local setup" }));

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledTimes(1);
    });
    const copied = clipboardWriteText.mock.calls[0]?.[0] ?? "";
    expect(copied).toContain("CODE_RUNTIME_SERVICE_PROVIDER_EXTENSIONS_JSON=");
    expect(copied).toContain('model_provider = "relay_one_api"');
    expect(copied).toContain("relay_one_api_relay_quality");
    expect(
      screen.getByText("Local setup, Codex shell config, and relay quality plugin copied.")
    ).toBeTruthy();
  });

  it("blocks apply when the selected relay path needs operator confirmation", () => {
    const onApplyConfig = vi.fn();
    render(<SettingsRelayAssistantSection surface={{ onApplyConfig }} />);

    fireEvent.change(screen.getByLabelText("Relay type"), {
      target: { value: "sub2api" },
    });
    fireEvent.change(screen.getByLabelText("Gateway base URL"), {
      target: { value: "https://sub2api.example.com/openai" },
    });

    expect(
      screen.getByText("Confirm the relay's OpenAI-compatible base path; most deployments use /v1.")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apply locally" })).toHaveProperty("disabled", true);
  });

  it("applies generated config through a connected local settings writer", async () => {
    const onApplyConfig = vi.fn(async () => undefined);
    render(<SettingsRelayAssistantSection surface={{ defaultKind: "new-api", onApplyConfig }} />);

    fireEvent.click(screen.getByRole("button", { name: "Apply locally" }));

    await waitFor(() => {
      expect(onApplyConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          codexConfigToml: expect.stringContaining('model_provider = "relay_new_api"'),
          providerExtension: expect.objectContaining({
            providerId: "relay_new_api",
          }),
          qualityPlugin: expect.objectContaining({
            pluginId: "relay_new_api_relay_quality",
          }),
          providerExtensionsJson: expect.stringContaining('"providerId":"relay_new_api"'),
        })
      );
    });
    expect(
      screen.getByText("Relay provider config applied to the local settings writer.")
    ).toBeTruthy();
  });
});
