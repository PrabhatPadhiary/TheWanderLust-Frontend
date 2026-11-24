/**
 * Sliding number (after Motion Primitives' Sliding Number): when the value
 * changes, the old number slides out and the new one slides in (up when it
 * grows, down when it shrinks). The edges fade with a mask rather than being
 * clipped, so tall display numerals are never cut off and the number keeps its
 * natural width. Styles: `.sn*` in src/styles/_motion.scss. Screen readers read
 * the plain number.
 */
export function setSlidingNumber(el: HTMLElement, value: number): void {
  const text = String(Math.max(0, Math.round(value)));
  if (el.dataset['sn'] === text) return;
  let box = el.querySelector<HTMLElement>('.sn');
  if (!box) {
    el.textContent = '';
    box = document.createElement('span');
    box.className = 'sn';
    box.setAttribute('aria-hidden', 'true');
    const sr = document.createElement('span');
    sr.className = 'wl-sr-only';
    el.append(box, sr);
  }
  const prev = box.querySelector<HTMLElement>('.sn-v:not(.sn-out-up):not(.sn-out-down)');
  const next = document.createElement('span');
  next.className = 'sn-v';
  next.textContent = text;
  if (prev) {
    const up = Number(text) >= Number(prev.textContent);
    next.classList.add(up ? 'sn-from-below' : 'sn-from-above');
    box.appendChild(next);
    next.getBoundingClientRect();   // start from there, then slide in
    next.classList.remove('sn-from-below', 'sn-from-above');
    prev.classList.add(up ? 'sn-out-up' : 'sn-out-down');
    setTimeout(() => prev.remove(), 700);
  } else {
    box.appendChild(next);
  }
  el.querySelector('.wl-sr-only')!.textContent = text;
  el.dataset['sn'] = text;
}
