import { Switch } from "./Switch";

interface ZoomToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function ZoomToggle({ enabled, onChange }: ZoomToggleProps) {
  return <Switch label="Zoom to fill" checked={enabled} onChange={onChange} />;
}
