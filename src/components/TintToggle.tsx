import { Switch } from "./Switch";

interface TintToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function TintToggle({ enabled, onChange }: TintToggleProps) {
  return <Switch label="Difficulty tints" checked={enabled} onChange={onChange} />;
}
