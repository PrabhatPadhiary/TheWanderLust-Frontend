import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * "Plan it together": a live trip board that fills up as you scroll.
 *
 * Friends join, Riya's cursor adds a desert safari, Meera's cursor votes on
 * dinner and the votes tick in, a comment gets a reply, and an invite link
 * brings one more person in. The steps on the left light up as it goes.
 * Scrubbed, so it runs backwards too. The board is plain HTML (no images).
 */

export interface CrewMember { id: string; name: string; color: string; }

export const CREW: CrewMember[] = [
  { id: 'you', name: 'You', color: '#1C2833' },
  { id: 'riya', name: 'Riya', color: '#D9481C' },
  { id: 'meera', name: 'Meera', color: '#3F5A73' },
  { id: 'sam', name: 'Sam', color: '#A53412' },
  { id: 'kabir', name: 'Kabir', color: '#4F6070' },
];

export function planTogetherStory(section: HTMLElement, onTrigger: (t: ScrollTrigger) => void, animated: boolean): void {
  const board = section.querySelector<HTMLElement>('.board');
  if (!board) return;
  const q = <T extends Element>(sel: string) => section.querySelector<T>(sel)!;
  const qa = <T extends Element>(sel: string) => Array.from(section.querySelectorAll<T>(sel));
  const steps = qa<HTMLElement>('.together-steps li');
  const votes = qa<HTMLElement>('[data-votes]');

  if (!animated) {
    section.classList.add('static');
    votes.forEach(v => (v.textContent = v.dataset['votes'] || '0'));
    return;
  }

  /** Where an element sits inside the board (for the cursors). */
  const rel = (sel: string, fx = 0.5, fy = 0.5) => () => {
    const b = board.getBoundingClientRect(), r = q<HTMLElement>(sel).getBoundingClientRect();
    return { x: r.left - b.left + r.width * fx, y: r.top - b.top + r.height * fy };
  };
  const moveTo = (cursor: string, target: string, at: number, dur: number, fx = 0.5, fy = 0.5) => {
    const p = rel(target, fx, fy);
    tl.to(q(cursor), { x: () => p().x, y: () => p().y, duration: dur, ease: 'power2.inOut' }, at);
  };
  const click = (cursor: string, at: number) =>
    tl.fromTo(q(`${cursor} .tap`), { scale: 0.2, opacity: 0.9 }, { scale: 2.2, opacity: 0, duration: 0.35, ease: 'power1.out', immediateRender: false }, at);

  // Start state.
  gsap.set(qa('.person:not([data-id="you"])'), { scale: 0, autoAlpha: 0 });
  gsap.set(q('.slot.new'), { autoAlpha: 0, x: 40 });
  gsap.set(qa('.poll .bar i'), { scaleX: 0, transformOrigin: '0 50%' });
  gsap.set(qa('.poll .won'), { autoAlpha: 0, scale: 0.6 });
  gsap.set(qa('.bubble'), { autoAlpha: 0, scale: 0.6, y: 10 });
  gsap.set(qa('.cursor'), { autoAlpha: 0, x: () => board.clientWidth * 0.9, y: () => board.clientHeight * 0.95 });
  gsap.set(qa('.board-toast'), { autoAlpha: 0, y: 16 });
  gsap.set(q('.board-done'), { autoAlpha: 0, y: 20 });

  const stepTimes = [0, 1.6, 3.4, 5.8];
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: () => {
      const now = tl.time();
      const at = stepTimes.filter(t => now >= t).length - 1;
      steps.forEach((s, i) => { s.classList.toggle('on', i === at); s.classList.toggle('done', i < at || now >= 8.8); });
    },
  });
  const join = (id: string, at: number) =>
    tl.to(q(`.person[data-id="${id}"]`), { scale: 1, autoAlpha: 1, duration: 0.3, ease: 'back.out(2.5)' }, at);
  const toast = (sel: string, at: number, until: number) =>
    tl.to(q(sel), { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out' }, at)
      .to(q(sel), { autoAlpha: 0, y: -10, duration: 0.25, ease: 'power2.in' }, until);

  // 1: the crew joins.
  tl.to({}, { duration: 0.3 }, 0);
  join('riya', 0.4);
  join('meera', 0.7);
  join('sam', 1.0);
  toast('.board-toast.joined', 0.5, 1.5);

  // 2: Riya adds a desert safari.
  tl.to(q('.cursor.riya'), { autoAlpha: 1, duration: 0.2 }, 1.6);
  moveTo('.cursor.riya', '.add-place', 1.7, 0.8, 0.3, 0.5);
  click('.cursor.riya', 2.5);
  tl.to(q('.slot.new'), { autoAlpha: 1, x: 0, duration: 0.4, ease: 'power3.out' }, 2.6);
  tl.fromTo(q('.slot.new'), { boxShadow: '0 0 0 2px rgba(217,72,28,0.9)' }, { boxShadow: '0 0 0 2px rgba(217,72,28,0)', duration: 0.8, immediateRender: false }, 2.8);
  moveTo('.cursor.riya', '.slot.new b', 2.8, 0.5, 1.1, 0.6);

  // 3: Meera votes on dinner; the votes come in.
  tl.to(q('.cursor.meera'), { autoAlpha: 1, duration: 0.2 }, 3.4);
  moveTo('.cursor.meera', '.poll .opt.a', 3.4, 0.7, 0.35, 0.5);
  click('.cursor.meera', 4.1);
  const tally = { a: 0, b: 0 };
  const [va, vb] = votes;
  tl.to(tally, {
    a: 3, b: 1, duration: 1.0, ease: 'power1.out',
    onUpdate: () => { va.textContent = String(Math.round(tally.a)); vb.textContent = String(Math.round(tally.b)); },
  }, 4.2);
  tl.to(q('.poll .opt.a .bar i'), { scaleX: 0.75, duration: 1.0, ease: 'power2.out' }, 4.2)
    .to(q('.poll .opt.b .bar i'), { scaleX: 0.25, duration: 1.0, ease: 'power2.out' }, 4.2)
    .to(q('.poll .won'), { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, 5.3);
  moveTo('.cursor.riya', '.poll .opt.b', 4.3, 0.6, 0.5, 0.5);

  // 4: a comment and a reply on the safari.
  tl.to(qa('.cursor'), { autoAlpha: 0, duration: 0.3 }, 5.8);
  tl.to(q('.bubble.ask'), { autoAlpha: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(2)' }, 6.0)
    .to(q('.bubble.reply'), { autoAlpha: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(2)' }, 6.8);

  // 5: one more friend joins from the invite link, and everyone's on the same plan.
  tl.fromTo(q('.invite'), { boxShadow: '0 0 0 0 rgba(217,72,28,0.6)' }, { boxShadow: '0 0 0 10px rgba(217,72,28,0)', duration: 0.6, immediateRender: false }, 7.5);
  toast('.board-toast.invited', 7.6, 8.6);
  join('kabir', 8.1);
  tl.to(q('.board-done'), { autoAlpha: 1, y: 0, duration: 0.35, ease: 'back.out(1.6)' }, 8.8)
    .to({}, { duration: 0.8 }, 9.2);

  onTrigger(ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.8,
    invalidateOnRefresh: true,
    animation: tl,
  }));
}
