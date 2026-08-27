interface TintToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function TintToggle({ enabled, onChange }: TintToggleProps) {
  return (
    <label className="flex items-center justify-between gap-2 min-h-12 text-ink cursor-pointer select-none">
      <span className="text-base">Difficulty tints</span>
      <span className="relative inline-block w-10 h-6">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-ink-muted/40 peer-checked:bg-brand transition-colors" />
        <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-tile transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
