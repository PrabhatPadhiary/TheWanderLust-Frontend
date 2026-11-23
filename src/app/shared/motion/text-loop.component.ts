import { AfterViewInit, Component, ElementRef, Input, NgZone, OnDestroy } from '@angular/core';
import { isBrowser, reducedMotion } from './motion-env';

/**
 * Text loop (after Motion Primitives' Text Loop / Text Roll): the words take
 * turns, each rolling up letter by letter. All words share one grid cell, so
 * the line never changes width. Screen readers get the first word only.
 */
@Component({
  selector: 'app-text-loop',
  standalone: false,
  template: `
    <span class="tl" aria-hidden="true">
      <span class="tl-word" *ngFor="let w of words; let i = index" [class.on]="i === 0">
        <span class="tl-ch" *ngFor="let c of letters(w); let j = index" [style.--j]="j">{{ c }}</span>
      </span>
    </span>
    <span class="wl-sr-only">{{ words[0] }}</span>
  `,
  styles: [`
    :host { display: inline-block; }
    .tl { display: inline-grid; justify-items: center; vertical-align: bottom; }
    .tl-word {
      grid-area: 1 / 1;
      display: inline-block;
      white-space: pre;
      overflow: hidden;
      /* room for italic overhang and descenders inside the clip */
      padding: 0 0.12em 0.14em; margin: 0 -0.12em -0.14em;
    }
    .tl-ch {
      display: inline-block;
      transform: translateY(105%);
      opacity: 0;
      transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
      transition-delay: calc(var(--j) * 22ms);
    }
    .tl-word.on .tl-ch { transform: none; opacity: 1; }
    .tl-word.out .tl-ch { transform: translateY(-105%); opacity: 0; transition-duration: 0.4s, 0.25s; }
  `],
})
export class TextLoopComponent implements AfterViewInit, OnDestroy {
  @Input() words: string[] = [];
  /** Time each word stays (ms). */
  @Input() interval = 2600;
  /** Wait before the first change (ms), e.g. until an opening animation is done. */
  @Input() startDelay = 0;

  private timer: any;
  private delay: any;

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  /** Letters, with spaces kept as real (non-collapsing) spaces. */
  letters(w: string): string[] { return w.split('').map(c => (c === ' ' ? ' ' : c)); }

  ngAfterViewInit(): void {
    if (!isBrowser() || reducedMotion() || this.words.length < 2) return;
    const els = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.tl-word'));
    let i = 0;
    const next = () => {
      if (document.hidden) return;   // don't run on in a background tab
      const cur = els[i], n = els[(i + 1) % els.length];
      cur.classList.remove('on');
      cur.classList.add('out');
      n.classList.remove('out');
      n.classList.add('on');
      // Once it has rolled out, the old word drops back below, ready for its turn.
      setTimeout(() => { if (!cur.classList.contains('on')) cur.classList.remove('out'); }, 700);
      i = (i + 1) % els.length;
    };
    this.zone.runOutsideAngular(() => {
      this.delay = setTimeout(() => { this.timer = setInterval(next, this.interval); }, this.startDelay);
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.delay);
    clearInterval(this.timer);
  }
}
