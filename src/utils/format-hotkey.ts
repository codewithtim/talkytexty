const isMac = () => navigator.platform.startsWith("Mac");

const MAC_SYMBOLS: Record<string, string> = {
  commandorcontrol: "⌘",
  command: "⌘",
  control: "⌃",
  ctrl: "⌃",
  shift: "⇧",
  alt: "⌥",
  option: "⌥",
  super: "⌘",
};

const WIN_LABELS: Record<string, string> = {
  commandorcontrol: "Ctrl",
  command: "Super",
  control: "Ctrl",
  ctrl: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  option: "Alt",
  super: "Win",
};

export function formatHotkeyForDisplay(keyCombination: string): string {
  const parts = keyCombination.split("+");
  const mac = isMac();
  const map = mac ? MAC_SYMBOLS : WIN_LABELS;

  const formatted = parts.map((part) => {
    const lower = part.toLowerCase();
    return map[lower] ?? part;
  });

  return mac ? formatted.join("") : formatted.join("+");
}
