interface AppBarProps {
  title: string;
  onOpenMenu: () => void;
}

// Fixed height (rather than padding-driven) so per-card sticky name labels in
// TripPage.tsx can dock directly under it via a matching `top-16`.
export function AppBar({ title, onOpenMenu }: AppBarProps) {
  return (
    <header className="sticky top-0 z-40 h-16 flex items-center bg-background/85 backdrop-blur-md border-b border-ink-muted/20 px-4 text-left">
      <div className="flex items-center justify-between gap-4 w-full">
        <h1 className="max-w-[55%] truncate text-lg md:text-2xl font-bold text-foreground">{title}</h1>
        <button
          type="button"
          onClick={onOpenMenu}
          className="shrink-0 inline-flex items-center min-h-11 rounded-full bg-brand text-brand-foreground px-4 text-sm font-semibold"
        >
          Menu
        </button>
      </div>
    </header>
  );
}
