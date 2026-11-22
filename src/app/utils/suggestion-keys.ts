/**
 * Keyboard for a text field with a list of suggestions under it:
 * Up / Down move the highlight, Enter picks the highlighted one (or the first),
 * Escape closes the list. Returns the new highlighted index (-1 = none).
 */
export function suggestionKeys(
  e: KeyboardEvent,
  active: number,
  count: number,
  on: { pick: (index: number) => void; close: () => void; open?: () => void; isOpen?: boolean }
): number {
  if (e.isComposing) return active; // typing with an IME: leave its keys alone
  switch (e.key) {
    case 'ArrowDown':
      if (!count) return active;
      e.preventDefault();
      on.open?.();
      return (active + 1) % count;
    case 'ArrowUp':
      if (!count) return active;
      e.preventDefault();
      on.open?.();
      return active <= 0 ? count - 1 : active - 1;
    case 'Enter':
      if (!count) return active;
      e.preventDefault();
      on.pick(active >= 0 && active < count ? active : 0);
      return -1;
    case 'Escape':
      // Close just the list, not whatever dialog the field sits in.
      if (on.isOpen !== false && count) e.stopPropagation();
      on.close();
      return -1;
  }
  return active;
}
