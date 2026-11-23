import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy } from '@angular/core';
import { finePointer, reducedMotion } from './motion-env';

/**
 * Magnetic (after Motion Primitives' Magnetic): the element leans toward the
 * cursor while it's over it, and springs back when it leaves. Mouse/trackpad
 * only. Uses the `translate` property, so the element's own hover and press
 * transforms still work.
 */
@Directive({ selector: '[appMagnetic]', standalone: false })
export class MagneticDirective implements AfterViewInit, OnDestroy {
  /** How strongly it follows (0-1). */
  @Input() appMagnetic: number | '' = '';
  /** Furthest it moves (px). */
  @Input() magneticMax = 8;
  private off: (() => void)[] = [];
  private raf = 0;

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (!finePointer() || reducedMotion()) return;
    const el = this.host.nativeElement;
    const strength = typeof this.appMagnetic === 'number' ? this.appMagnetic : 0.3;
    let tx = 0, ty = 0, x = 0, y = 0;
    const loop = () => {
      // Ease toward the target each frame (a soft spring); stop once settled.
      x += (tx - x) * 0.18; y += (ty - y) * 0.18;
      el.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
      if (Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05) this.raf = requestAnimationFrame(loop);
      else { this.raf = 0; if (!tx && !ty) el.style.translate = ''; }
    };
    const kick = () => { if (!this.raf) this.raf = requestAnimationFrame(loop); };
    const clamp = (v: number) => Math.max(-this.magneticMax, Math.min(this.magneticMax, v));
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = clamp((e.clientX - (r.left + r.width / 2)) * strength);
      ty = clamp((e.clientY - (r.top + r.height / 2)) * strength);
      kick();
    };
    const leave = () => { tx = 0; ty = 0; kick(); };
    this.zone.runOutsideAngular(() => {
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
    });
    this.off.push(() => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); });
  }

  ngOnDestroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);   // never set on the server (no rAF there)
    this.off.forEach(f => f());
  }
}
