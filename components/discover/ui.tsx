'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function DiscoverPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('rounded-xl border border-border bg-card shadow-sm overflow-hidden', className)}
    >
      {children}
    </section>
  );
}

export function DiscoverSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1 min-w-[min(100%,220px)]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
      />
    </div>
  );
}

export function DiscoverSelect({
  label,
  value,
  onValueChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn('min-w-[140px]', className)}>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-10 w-full rounded-lg border-border bg-background text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-border bg-popover">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-sm">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DiscoverToggleButton({
  active,
  count,
  onClick,
}: {
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground hover:border-ring hover:text-foreground'
      )}
    >
      <SlidersHorizontal className="h-4 w-4" />
      More filters
      {count != null && count > 0 && (
        <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
          {count}
        </span>
      )}
    </button>
  );
}

export function DiscoverClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
    >
      Clear all
    </button>
  );
}

export function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
      <span className="shrink-0 pt-1.5 text-xs font-medium text-muted-foreground sm:w-16">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function GenrePills({
  genres,
  selected,
  onToggle,
}: {
  genres: readonly string[];
  selected: string[];
  onToggle: (genre: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {genres.map((genre) => {
        const isSelected = selected.includes(genre);
        return (
          <button
            key={genre}
            type="button"
            onClick={() => onToggle(genre)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-ring hover:text-foreground'
            )}
          >
            {genre}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-1 pl-2.5 pr-1 text-xs text-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
