/**
 * Sliding number (after Motion Primitives' Sliding Number): each digit is a
 * column of 0-9 that rolls to its value, like an odometer. Styles: `.sn-*` in
 * src/styles/_motion.scss. Screen readers read the plain number.
 */
export function setSlidingNumber(el: HTMLElement, value: number): void {
  const text = String(Math.max(0, Math.round(value)));
  if (el.dataset['sn'] === text) return;
  const digits = Math.max(2, text.length);
  let cols = el.querySelector<HTMLElement>('.sn-cols');
  if (!cols || cols.children.length !== digits) {
    el.textContent = '';
    cols = document.createElement('span');
    cols.className = 'sn-cols';
    cols.setAttribute('aria-hidden', 'true');
    for (let d = 0; d < digits; d++) {
      const col = document.createElement('span');
      col.className = 'sn-col';
      const track = document.createElement('span');
      track.className = 'sn-track';
      track.innerHTML = Array.from({ length: 10 }, (_, k) => `<span>${k}</span>`).join('');
      col.appendChild(track);
      cols.appendChild(col);
    }
    const sr = document.createElement('span');
    sr.className = 'wl-sr-only';
    el.append(cols, sr);
  }
  const padded = text.padStart(digits, '0');
  Array.from(cols.children).forEach((col, d) => {
    const n = Number(padded[d]);
    // Leading zeros fold away (the number is never shown as "09").
    col.classList.toggle('lead', d < digits - text.length);
    (col.firstElementChild as HTMLElement).style.transform = `translateY(${-n * 10}%)`;
  });
  el.querySelector('.wl-sr-only')!.textContent = text;
  el.dataset['sn'] = text;
}
