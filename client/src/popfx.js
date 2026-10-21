// Scroll-triggered comic "pop" for headings and labels.
// Animates the element itself with the Web Animations API (scale / rotate / opacity), so React's DOM is never touched,
// long paragraphs are never split into letters, and CSS animations already on the element keep working.
const SEL = 'main h1:not([data-ct]),main h2,main h3,main .narr,main .burst-tag';
const FRAMES = [
  { opacity: 0, scale: '.72', rotate: '-4deg', easing: 'cubic-bezier(.2,.9,.3,1)' },
  { opacity: 1, scale: '1.1', rotate: '1.5deg', offset: .55, easing: 'ease-out' },
  { opacity: 1, scale: '.97', rotate: '-.5deg', offset: .8, easing: 'ease-out' },
  { opacity: 1, scale: '1', rotate: '0deg' },
];

export function initPopFx(isOn) {
  if (typeof IntersectionObserver === 'undefined') return;
  const seen = new WeakSet();
  const play = el => {
    el.classList.remove('pp');
    if (!isOn() || !el.animate) return;
    el.animate(FRAMES, { duration: 380, easing: 'linear', fill: 'backwards' });
  };
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); play(e.target); }
  }, { rootMargin: '0px 0px -6% 0px', threshold: .01 });
  const reg = el => {
    if (seen.has(el) || el.closest('.modal')) return;
    seen.add(el);
    if (!isOn()) return;
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * .94 && r.bottom > 0) return play(el);   // already on screen: pop right away
    el.classList.add('pp'); io.observe(el);                             // below the fold: stay hidden until scrolled into view
  };
  const scan = n => { if (n.nodeType !== 1) return; if (n.matches?.(SEL)) reg(n); n.querySelectorAll?.(SEL).forEach(reg); };
  new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(scan); }).observe(document.body, { childList: true, subtree: true });
  scan(document.body);
}
