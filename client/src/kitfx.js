/* Comic UI Kit engine, adapted to the live site: registers real components (buttons, forms, text boxes, search) and drives
   particles, word popups, shakes and motion. Exposed API at the bottom (kitApi). */
let kitApi = null;
export function initKitFx() {
  if (kitApi) return kitApi;
  'use strict';
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const root = document.documentElement;
  let status = $('#kit-status');
  if (!status) { status = document.createElement('p'); status.id = 'kit-status'; status.className = 'sr-only'; status.setAttribute('aria-live', 'polite'); document.body.append(status); }
  let motionOn = true;
  let theme = 'light';
  let seed = 7341;
  let paletteHue = 48;

  /* Tiny spring helper: anticipation, overshoot, then settle. */
  const spring = (el, {duration=520, from=0.82, overshoot=1.08, rotate=0}={}) => {
    if (!motionOn || !el || !el.animate) return;
    try {
      el.animate([
        {scale: `${from} ${Math.min(1.12, 2-from)}`, rotate: `${-rotate}deg`, offset: 0},
        {scale: `${overshoot} ${Math.max(.92, 2-overshoot)}`, rotate: `${rotate}deg`, offset: .62},
        {scale: '0.985 1.025', rotate: `${-rotate*.25}deg`, offset: .82},
        {scale: '1 1', rotate: '0deg', offset: 1}
      ], {duration, easing: 'cubic-bezier(.18,.89,.32,1.35)'});
    } catch (_) {}
  };

  const KINDS=['button','form','text','slider','search'], BASE={button:0,form:15,text:30,slider:45,search:60};
  const allUnits=[];
  for(const kind of KINDS)for(let index=0;index<15;index++){const uid=BASE[kind]+index+1;allUnits.push({uid,id:String(uid).padStart(3,'0'),kind,index});}
  const PAT={button:/\bb(\d+)\b/,form:/\bf(\d+)\b/,text:/\bt(\d+)\b/,search:/\bsb(\d+)\b/};
  const SELS=[['button','.bt'],['form','form.f'],['text','.tb'],['search','.sb']];
  function register(el,kind){
    if(el.classList.contains('comic-unit'))return;
    const m=PAT[kind].exec(el.className);if(!m)return;
    const index=Math.min(14,Math.max(0,+m[1]-1)),id=String(BASE[kind]+index+1).padStart(3,'0');
    el.classList.add('comic-unit',`unit-${id}`);el.dataset.uid=id;el.dataset.kind=kind;el.dataset.index=String(index);
  }
  function scan(rootEl=document){for(const [kind,sel] of SELS)rootEl.querySelectorAll?.(sel).forEach(el=>register(el,kind));if(rootEl.matches)for(const [kind,sel] of SELS)if(rootEl.matches(sel))register(rootEl,kind);}
  /* Distinct parameters are generated per component, not shared across the 75 units. */
  const motionCSS = [];
  for (const u of allUnits) {
    const n = u.uid;
    const dx = ((n * 7) % 13) - 6;
    const dy = -1 - ((n * 11) % 5);
    const rot = ((n * 5) % 15) - 7;
    const sx = 1.025 + ((n * 3) % 9) / 100;
    const sy = 1.025 + ((n * 7) % 7) / 100;
    const hoverMs = 285 + ((n * 47) % 383);
    const pressMs = 245 + ((n * 37) % 277);
    const focusMs = 260 + ((n * 41) % 221);
    const ringOffset = 2 + (n % 5);
    const ringColor = ['var(--r)','var(--b)','var(--p)','var(--g)','var(--y)'][n % 5];
    motionCSS.push(`
      @keyframes hover-${u.id}{0%{translate:0 0;rotate:0deg;scale:1 1}29%{translate:${dx}px ${dy}px;rotate:${rot}deg;scale:${sx} ${sy}}57%{translate:${-dx*.42}px ${dy*.2}px;rotate:${-rot*.48}deg;scale:${Math.max(.96,sx-.045)} ${Math.min(1.09,sy+.015)}}78%{translate:${dx*.22}px ${-dy*.25}px;rotate:${rot*.2}deg;scale:1.015 .99}100%{translate:0 0;rotate:0deg;scale:1.01 1.01}}
      @keyframes press-${u.id}{0%{scale:1 1;translate:0 0;rotate:0deg}18%{scale:.${82+(n%8)} 1.12;translate:${dx*.45}px ${Math.abs(dy)*.45}px;rotate:${-rot*.8}deg}49%{scale:${1.08+(n%5)/100} .${88+(n%7)};translate:${-dx*.25}px -2px;rotate:${rot*.45}deg}73%{scale:.985 1.025;translate:0 1px;rotate:${-rot*.15}deg}100%{scale:1 1;translate:0 0;rotate:0deg}}
      @keyframes focus-${u.id}{0%{translate:0 0;rotate:0deg;scale:1 1}32%{translate:${dx*.5}px ${dy*.35}px;rotate:${rot*.6}deg;scale:${1.03+(n%4)*.01} ${1.02+(n%5)*.01}}62%{translate:${-dx*.2}px 0;rotate:${-rot*.2}deg;scale:.99 1.02}100%{translate:0 0;rotate:0deg;scale:1 1}}
      .unit-${u.id}{transform-origin:${(n*17)%100}% ${(n*29)%100}%;transition:translate ${180+(n*19)%260}ms cubic-bezier(.2,.8,.25,1.18),rotate ${210+(n*31)%290}ms cubic-bezier(.2,.8,.25,1.18),scale ${160+(n*23)%220}ms cubic-bezier(.2,.8,.25,1.18);filter:saturate(${(0.94+(n%9)*.015).toFixed(3)}) contrast(${(0.985+(n%5)*.009).toFixed(3)});}
      .unit-${u.id}:hover{animation:hover-${u.id} ${hoverMs}ms cubic-bezier(.2,.78,.25,1.28) both;}
      .unit-${u.id}.hit{animation:press-${u.id} ${pressMs}ms cubic-bezier(.18,.89,.32,1.35) both;}
      .unit-${u.id}:active{translate:${(n%2 ? -1 : 1)*(1+n%3)}px ${1+n%2}px;scale:${.91+(n%7)/100} ${1.04-(n%4)/100};transition:translate ${90+n%80}ms,scale ${90+n%80}ms;}
      ${u.kind === 'slider' ? `.unit-${u.id}.dn:hover{animation:none!important;translate:0 0!important;rotate:0deg!important;scale:1 1!important;}` : ''}
      .unit-${u.id}:focus-visible,.unit-${u.id}:focus-within{outline:3px solid ${ringColor};outline-offset:${ringOffset}px;animation:focus-${u.id} ${focusMs}ms ${['cubic-bezier(.2,.8,.2,1)','cubic-bezier(.18,.89,.32,1.22)','steps(4,end)'][n%3]} both;}
      .unit-${u.id} input:focus-visible,.unit-${u.id} button:focus-visible{outline:3px solid ${ringColor};outline-offset:2px;position:relative;z-index:2;}
    `);
  }
  const dynamicStyle = document.createElement('style');
  dynamicStyle.id = 'per-component-motion';
  dynamicStyle.textContent = motionCSS.join('\n');
  document.head.append(dynamicStyle);

  /* Keep accessible text while applying the hand-lettered hover rhythm. */
  function wrapLetters(el) {
    if (el.dataset.wrapped) return;
    const label = el.textContent;
    el.dataset.wrapped = 'true';
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', label.trim());
    el.textContent = '';
    [...label].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'lt';
      span.style.setProperty('--j', i);
      span.textContent = ch;
      span.setAttribute('aria-hidden', 'true');
      el.append(span);
    });
  }

  /* One canvas engine, hard-capped at 600 particles, idle RAF stops completely. */
  const canvas = document.createElement('canvas');
  canvas.id = 'comic-particles';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:98';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d', {alpha:true});
  let dpr = 1, particles = [], raf = 0;
  const LOW = matchMedia('(pointer:coarse)').matches || innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 4;   // phones / weak CPUs get half the particles
  const CAP = LOW ? 240 : 600;
  const baseColors = ['#ff3b3b','#ffd400','#2ea8ff','#3ddc84','#ff5fc8'];
  const debug = {particleSpawnCalls:0, particleTotalSpawned:0, wordFades:0, lastParticleKind:'', lastInteraction:'', maxLiveParticles:0};
  window.__comicDebug = debug;
  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(innerWidth * dpr));
    canvas.height = Math.max(1, Math.floor(innerHeight * dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resizeCanvas();
  addEventListener('resize', resizeCanvas, {passive:true});

  /* Every index has its own particles: shape, palette, gravity, speed, drag, lifetime and spawn arc vary. */
  const BUTTON_FX = [
    {n:26,sh:'star',s:10,g:.25,dc:.020,col:['#ff3b3b','#ffd400','#ff9500'],spawn:'burst',r:4,rr:7},
    {n:30,sh:'square',s:5,up:7,g:.30,dc:.015,col:['#fff','#ff3b3b','#ffd400'],spawn:'fountain',r:3,rr:6},
    {n:22,sh:'line',s:13,g:0,dg:.93,a:[-.25,.25],col:['#2ea8ff','#00e5ff'],dc:.030,spawn:'speed',r:3,rr:4},
    {n:12,sh:'ring',s:2,up:2,g:-.06,col:['#2ea8ff','#3ddc84'],r:6,rr:8,dc:.012,spawn:'halo'},
    {n:44,sh:'circle',s:12,dg:.93,g:.12,dc:.014,col:['#ff3b3b','#ffd400','#ff9500'],spawn:'explosion'},
    {n:14,sh:'heart',s:3,up:3,g:-.05,col:['#ff5fc8','#ff3b3b','#ffb3d9'],r:6,dc:.012,spawn:'float'},
    {n:40,sh:'circle',s:3.5,g:0,dg:.95,col:['#111','#fff','#ffd400'],r:2,rr:3,dc:.014,vr:0,spawn:'confetti'},
    {n:16,sh:'bolt',s:9,g:.1,col:['#ffd400','#fff'],r:7,dc:.04,spawn:'zigzag'},
    {n:18,sh:'dia',s:7,g:.2,col:['#111','#fff','#ffd400'],vr:.3,spawn:'diamond'},
    {n:24,sh:'tri',s:5,up:6,g:.28,col:['#ff3b3b','#fff','#ffd400'],dc:.016,spawn:'rain'},
    {n:14,sh:'plus',s:9,g:0,dg:.9,a:[2.94,3.34],col:['#2ea8ff','#00e5ff'],dc:.025,spawn:'left-spray'},
    {n:12,ch:['?','!','#','@','%'],sz:28,s:6,up:4,col:['#ff3b3b','#ffd400','#ff9500'],spawn:'glyphs'},
    {n:30,sh:'square',s:3,g:0,jit:4,col:['#ff3b3b','#2ea8ff','#fff'],r:3,rr:5,dc:.04,vr:0,spawn:'glitch'},
    {n:3,sh:'ring',s:0,up:0,g:0,gr:2.5,r:2,rr:14,dc:.03,col:['#ff5fc8','#ffb3d9'],spawn:'expanding-rings'},
    {n:14,ch:['🔥','✨'],sz:22,s:3,up:8,g:-.15,dc:.025,a:[1.2,1.9],spawn:'launch'}
  ];
  const FORM_FX = [
    {n:22,sh:'star',s:7,up:4,g:.26,dc:.018,col:['#ff3b3b','#ffd400'],spawn:'badge-burst',r:4,rr:7},
    {n:18,sh:'heart',s:4,up:6,g:-.09,dc:.014,col:['#ff5fc8','#ffb3d9'],spawn:'love-rise',r:5,rr:7},
    {n:28,sh:'circle',s:8,up:7,g:.16,dc:.022,col:['#ff9500','#ffd400','#fff'],spawn:'confetti-fall',r:2,rr:5},
    {n:16,sh:'line',s:11,g:0,dg:.91,a:[-.5,.5],col:['#111','#ff3b3b'],dc:.035,spawn:'reporter-flash',r:2,rr:5},
    {n:35,sh:'tri',s:6,up:8,g:.22,dc:.017,col:['#ff5fc8','#ffd400','#fff'],spawn:'pink-fan',r:4,rr:6},
    {n:14,sh:'bolt',s:10,g:.08,dc:.028,col:['#2ea8ff','#fff'],spawn:'hero-zap',r:4,rr:6},
    {n:25,sh:'square',s:4,up:5,g:.31,dc:.016,col:['#111','#ffd400','#fff'],spawn:'paper-squares',r:3,rr:5},
    {n:20,sh:'ring',s:5,up:0,g:-.03,dc:.012,col:['#2ea8ff','#00e5ff'],spawn:'neon-orbit',r:4,rr:7},
    {n:18,sh:'dia',s:8,up:2,g:.13,dc:.020,col:['#ffd400','#ff9500','#fff'],spawn:'ticket-shards',r:4,rr:6},
    {n:12,ch:['!','?','…'],sz:25,s:5,up:6,g:.03,dc:.020,col:['#111','#fff'],spawn:'noir-type'},
    {n:24,sh:'circle',s:2.5,up:9,g:.28,dc:.022,col:['#ff9500','#ff3b3b','#ffd400'],spawn:'sticky-dots',r:2,rr:4},
    {n:16,sh:'bolt',s:7,up:3,g:.10,dc:.033,col:['#111','#3ddc84'],spawn:'villain-crackle',r:4,rr:7},
    {n:40,sh:'star',s:9,up:5,g:.25,dc:.015,col:['#ff5fc8','#ff3b3b','#ffd400'],spawn:'prize-spark',r:3,rr:6},
    {n:12,sh:'ring',s:1.4,up:3,g:-.10,dc:.010,col:['#2ea8ff','#fff'],spawn:'cloud-bubbles',r:5,rr:10},
    {n:20,sh:'line',s:14,up:2,g:.04,dg:.90,a:[2.5,3.8],dc:.028,col:['#ff3b3b','#111','#fff'],spawn:'retro-scan',r:2,rr:4}
  ];
  const TEXT_FX = [
    {n:1,sh:'circle',s:1.4,up:7,g:.5,dc:.018,col:['#ff3b3b'],spawn:'down-dot',chv:0},
    {n:1,sh:'square',s:1.6,up:8,g:.35,dc:.022,col:['#ffd400'],spawn:'square-hop',chv:-1},
    {n:1,sh:'star',s:1.1,up:9,g:.22,dc:.016,col:['#2ea8ff'],spawn:'star-float',chv:1},
    {n:1,sh:'tri',s:1.9,up:6,g:.6,dc:.027,col:['#3ddc84'],spawn:'triangle-drop',chv:-2},
    {n:1,sh:'dia',s:1.2,up:5,g:.08,dc:.014,col:['#ff5fc8'],spawn:'pink-diamond',chv:2},
    {n:1,sh:'line',s:2.2,up:7,g:.03,dc:.03,col:['#ff9500'],spawn:'horizontal-dash',chv:-3},
    {n:1,sh:'heart',s:.9,up:8,g:-.08,dc:.011,col:['#ff5fc8'],spawn:'heart-float',chv:0},
    {n:1,sh:'bolt',s:1.8,up:10,g:.17,dc:.024,col:['#2ea8ff'],spawn:'blue-zing',chv:2},
    {n:1,sh:'plus',s:1.3,up:7,g:.11,dc:.019,col:['#111'],spawn:'ink-cross',chv:-2},
    {n:1,sh:'circle',s:2.0,up:6,g:.24,dc:.031,col:['#ffd400'],spawn:'hard-pop',chv:3},
    {n:1,sh:'square',s:1.4,up:8,g:.0,dc:.013,col:['#ff3b3b'],spawn:'steps',chv:-1},
    {n:1,sh:'ring',s:1.7,up:5,g:-.12,dc:.012,col:['#3ddc84'],spawn:'ring-buoy',chv:1},
    {n:1,sh:'tri',s:1.5,up:9,g:.4,dc:.026,col:['#ff9500'],spawn:'orange-spring',chv:-3},
    {n:1,sh:'dia',s:1.0,up:5,g:.28,dc:.017,col:['#2ea8ff'],spawn:'blue-glint',chv:2},
    {n:1,sh:'star',s:2.3,up:11,g:-.04,dc:.015,col:['#ff5fc8'],spawn:'diary-lift',chv:-2}
  ];
  const SLIDER_FX = [
    {n:2,sh:'circle',s:2.5,up:1,col:['#ff3b3b','#ffd400'],dc:.03,spawn:'small-bubbles'},
    {n:2,ch:['🔥'],sz:18,s:1,up:0,vx:-3,g:0,dc:.04,spawn:'flame-backflow'},
    {n:1,sh:'star',s:1.2,g:0,dg:.95,col:['#ffd400','#fff'],dc:.015,r:5,spawn:'single-star'},
    {n:2,sh:'square',s:1.5,up:0,g:.35,col:['#2ea8ff','#fff'],dc:.025,vr:0,r:5,rr:3,spawn:'blue-blocks'},
    {n:2,sh:'line',s:2,g:0,jit:5,col:['#2ea8ff','#fff'],dc:.05,r:5,spawn:'jitter-lines'},
    {n:1,sh:'ring',s:.8,up:1.5,g:-.05,col:['#2ea8ff','#3ddc84'],r:5,rr:6,dc:.015,spawn:'floating-ripple'},
    {n:2,sh:'plus',s:2.5,up:1,col:['#ff5fc8','#ff3b3b'],dc:.025,vr:.25,spawn:'pink-plus'},
    {n:3,sh:'circle',s:2,g:0,dg:.96,col:['#111','#fff','#ffd400'],r:1.5,rr:2,dc:.02,vr:0,spawn:'noir-dust'},
    {n:1,sh:'bolt',s:5,g:.05,col:['#ffd400','#fff'],r:6,dc:.07,spawn:'lightning-dart'},
    {n:2,sh:'circle',s:1,up:3,g:-.08,col:['#ff3b3b','#ff9500','#ffd400'],r:3,rr:5,dc:.025,spawn:'warm-bubbles'},
    {n:1,ch:['♪','♫'],sz:24,s:1,up:3,g:-.02,col:['#ff5fc8','#2ea8ff'],dc:.015,spawn:'note-puff'},
    {n:3,sh:'circle',s:.8,g:0,dg:.97,col:['#ff3b3b','#ffd400','#2ea8ff'],dc:.012,r:4,rr:2,spawn:'rainbow-dots'},
    {n:2,sh:'dia',s:2,g:.1,col:['#3ddc84','#fff'],dc:.03,vr:.5,spawn:'green-gems'},
    {n:3,sh:'star',s:7,g:.1,col:['#ff3b3b','#ffd400','#ff9500'],dc:.05,r:4,spawn:'star-shards'},
    {n:2,sh:'tri',s:2,g:0,vx:-3,dg:.96,col:['#ff3b3b','#fff'],dc:.03,spawn:'leftward-triangles'}
  ];
  const SEARCH_FX = [
    {n:18,sh:'ring',s:3,up:1,g:-.06,dc:.012,col:['#2ea8ff','#fff'],spawn:'search-ripple',r:5,rr:9},
    {n:20,sh:'circle',s:2.4,up:3,g:-.04,dc:.016,col:['#ffd400','#ff3b3b'],spawn:'lens-orbit',r:3,rr:4},
    {n:15,sh:'heart',s:3,up:2,g:-.08,dc:.014,col:['#ff5fc8','#fff'],spawn:'chat-bubbles',r:5,rr:7},
    {n:22,sh:'dia',s:6,up:3,g:.1,dc:.02,col:['#111','#ffd400'],spawn:'detective-clues',r:3,rr:5},
    {n:12,sh:'line',s:8,up:0,g:0,dg:.9,a:[-1.2,1.2],dc:.033,col:['#ff3b3b','#fff'],spawn:'underlined-scan',r:2,rr:4},
    {n:24,ch:['G','O','!'],sz:22,s:5,up:6,g:.08,dc:.02,col:['#111','#fff'],spawn:'go-glyphs'},
    {n:16,sh:'tri',s:5,up:4,g:.15,dc:.018,col:['#2ea8ff','#3ddc84'],spawn:'telescope-flare',r:3,rr:5},
    {n:20,sh:'circle',s:3,up:1,g:0,dg:.91,jit:1,dc:.022,col:['#ff3b3b','#111'],spawn:'dashed-cloud',r:2,rr:4},
    {n:18,sh:'bolt',s:8,up:5,g:.14,dc:.04,col:['#ffd400','#fff'],spawn:'zap-impact',r:4,rr:7},
    {n:26,sh:'square',s:4,up:7,g:.24,dc:.016,col:['#2ea8ff','#ff3b3b','#ffd400'],spawn:'color-stripes',r:3,rr:5},
    {n:14,sh:'plus',s:5,up:3,g:.02,dc:.025,col:['#111','#fff'],spawn:'pow-crosses',r:4,rr:5},
    {n:18,sh:'ring',s:2,up:2,g:-.12,dc:.011,col:['#3ddc84','#00e5ff'],spawn:'satellite-rings',r:4,rr:8},
    {n:32,sh:'star',s:7,up:5,g:.21,dc:.014,col:['#ffd400','#ff5fc8'],spawn:'ticket-sparkle',r:3,rr:6},
    {n:16,sh:'line',s:9,up:0,g:0,dg:.94,a:[2.4,3.9],dc:.035,col:['#2ea8ff','#fff'],spawn:'flashlight-beam',r:2,rr:4},
    {n:21,sh:'hex',s:4,up:5,g:.13,dc:.019,col:['#ff9500','#ff3b3b','#ffd400'],spawn:'slot-machine-chips',r:3,rr:5}
  ];

  function pathFor(p) {
    const r = p.r;
    switch (p.sh) {
      case 'star': for(let j=0;j<10;j++){const a=j*Math.PI/5,q=j%2?r*.5:r*1.3;ctx.lineTo(Math.cos(a)*q,Math.sin(a)*q);}ctx.closePath();break;
      case 'circle':ctx.arc(0,0,r*.7,0,Math.PI*2);break;
      case 'ring':ctx.arc(0,0,r,0,Math.PI*2);break;
      case 'heart':ctx.moveTo(0,r*.5);ctx.bezierCurveTo(-r*1.4,-r*.4,-r*.5,-r*1.3,0,-r*.4);ctx.bezierCurveTo(r*.5,-r*1.3,r*1.4,-r*.4,0,r*.5);ctx.closePath();break;
      case 'bolt':ctx.moveTo(r*.3,-r*1.4);ctx.lineTo(-r*.7,r*.2);ctx.lineTo(0,r*.2);ctx.lineTo(-r*.3,r*1.4);ctx.lineTo(r*.8,-r*.3);ctx.lineTo(0,-r*.3);ctx.closePath();break;
      case 'line':ctx.rect(-r*1.5,-1.5,r*3,3);break;
      case 'tri':ctx.moveTo(0,-r);ctx.lineTo(r,r*.8);ctx.lineTo(-r,r*.8);ctx.closePath();break;
      case 'plus':ctx.rect(-r*.3,-r,r*.6,r*2);ctx.rect(-r,-r*.3,r*2,r*.6);break;
      case 'dia':ctx.moveTo(0,-r*1.2);ctx.lineTo(r*.8,0);ctx.lineTo(0,r*1.2);ctx.lineTo(-r*.8,0);ctx.closePath();break;
      case 'hex':for(let j=0;j<6;j++){const a=j*Math.PI/3;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();break;
      default:ctx.rect(-r/2,-r/2,r,r);
    }
  }
  function spawn(x,y,cfg,countOverride) {
    if (!motionOn || !cfg) return;
    let want = countOverride ?? cfg.n ?? 1; if (LOW && want > 2) want = Math.ceil(want * .5);
    const count = Math.max(0, Math.min(want, CAP));
    if (!count) return;
    if (particles.length + count > CAP) particles.splice(0, particles.length + count - CAP);
    const colors = cfg.col || baseColors;
    for (let i=0;i<count;i++) {
      let a;
      if (cfg.a) a = cfg.a[0] + Math.random()*(cfg.a[1]-cfg.a[0]);
      else if (cfg.spawn === 'halo' || cfg.spawn === 'ring' || cfg.spawn === 'expanding-rings' || cfg.spawn === 'search-ripple' || cfg.spawn === 'satellite-rings') a = Math.PI*2*i/Math.max(count,1);
      else if (cfg.spawn === 'fountain' || cfg.spawn === 'love-rise' || cfg.spawn === 'float' || cfg.spawn === 'cloud-bubbles') a = -Math.PI/2 + (Math.random()-.5)*1.5;
      else if (cfg.spawn === 'speed' || cfg.spawn === 'left-spray' || cfg.spawn === 'retro-scan' || cfg.spawn === 'flashlight-beam') a = Math.PI + (Math.random()-.5)*.9;
      else a = Math.random()*Math.PI*2;
      const speed = (cfg.s ?? 4) * (.42 + Math.random()*.92);
      const pick = v => Array.isArray(v) ? v[(Math.random()*v.length)|0] : v;
      particles.push({x,y,vx:Math.cos(a)*speed+(cfg.vx||0),vy:Math.sin(a)*speed-(cfg.up??2)+(cfg.vy||0),g:cfg.g??.18,drag:cfg.dg??.985,r:(cfg.r??4)+Math.random()*(cfg.rr??5),c:pick(colors),shape:pick(cfg.sh||'circle'),l:1,decay:cfg.dc??.02,rot:Math.random()*6.28,vr:cfg.vr??(Math.random()-.5)*.4,jit:cfg.jit||0,wv:cfg.wv||0,bounce:cfg.bn||0,floor:cfg.fl??innerHeight,grow:cfg.gr||0,ch:pick(cfg.ch),sz:cfg.sz||22,age:0,style:cfg.spawn||'burst'});
    }
    debug.particleSpawnCalls++;
    debug.particleTotalSpawned += count;
    debug.lastParticleKind = cfg.spawn || cfg.sh || 'burst';
    debug.maxLiveParticles = Math.max(debug.maxLiveParticles, particles.length);
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    raf = 0;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,innerWidth,innerHeight);
    for (let i=particles.length-1;i>=0;i--) {
      const p = particles[i];
      p.vy += p.g; p.vx *= p.drag;
      p.x += p.vx + Math.sin(p.age*.3)*p.wv + (Math.random()-.5)*p.jit;
      p.y += p.vy; p.age++; p.rot += p.vr; p.r += p.grow; p.l -= p.decay;
      if (p.bounce && p.y > p.floor && p.vy > 0) { p.y=p.floor; p.vy *= -p.bounce; }
      if (p.l <= 0 || p.y > innerHeight+100 || p.x < -120 || p.x > innerWidth+120) { particles.splice(i,1); continue; }
      ctx.globalAlpha = Math.max(0,Math.min(1,p.l)); ctx.fillStyle=p.c; ctx.strokeStyle='#111'; ctx.lineWidth=2;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      if (p.ch) { ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${p.sz}px Bangers,Impact,sans-serif`;ctx.lineWidth=3;ctx.strokeText(p.ch,0,0);ctx.fillText(p.ch,0,0); }
      else { ctx.beginPath();pathFor(p);if(p.shape==='ring'){ctx.lineWidth=2.5;ctx.strokeStyle=p.c;ctx.stroke();}else{ctx.fill();ctx.stroke();} }
      ctx.restore();
    }
    ctx.globalAlpha=1;
    if (particles.length) raf=requestAnimationFrame(tick); else ctx.clearRect(0,0,innerWidth,innerHeight);
  }

  /* ---- comic stickers: randomized word on a hand-cut starburst + an impact ring, always near the click, never blocking ---- */
  const STICKER_WORDS = ['BANG!','POW!','BOOM!','ZAP!','CLICK!','WHAM!'];
  const STICKER_BG = ['#ffd400','#ff3b3b','#2ea8ff','#3ddc84','#ff5fc8'];
  const randWord = () => STICKER_WORDS[(Math.random()*STICKER_WORDS.length)|0];
  function burstPoints(spikes=11) {
    const pts = [];
    for (let i=0;i<spikes*2;i++) { const a=Math.PI*i/spikes, r=(i%2?30:49)+(Math.random()-.5)*(i%2?4:9); pts.push(`${(Math.cos(a)*r).toFixed(1)},${(Math.sin(a)*r).toFixed(1)}`); }
    return pts.join(' ');
  }
  function impactRing(x, y, size=84) {
    if (!motionOn) return;
    const rings = document.querySelectorAll('.comic-ring'); if (rings.length >= 6) rings[0].remove();
    const ring = document.createElement('span');
    ring.className = 'comic-ring'; ring.setAttribute('aria-hidden','true');
    ring.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px`;
    document.body.append(ring);
    const done = () => ring.remove();
    try { ring.animate([{opacity:.95,scale:.25},{opacity:.7,scale:.9,offset:.55},{opacity:0,scale:1.5}],{duration:380,easing:'cubic-bezier(.2,.8,.3,1)'}).onfinish = done; } catch (_) { done(); }
    setTimeout(done, 900);
  }
  let lastSticker = 0;
  function comicWord(x, y, text) {
    if (!motionOn) return;
    lastSticker = performance.now();
    const live = document.querySelectorAll('.comic-word');
    if (live.length >= 5) live[0].remove();                       // repeated clicks never pile stickers up
    const word = text || randWord(), tilt = (Math.random()-.5)*30;
    // sit slightly above and beside the pointer so the finger / cursor and the button label stay readable
    const m = 70, cx = Math.max(m, Math.min(innerWidth-m, x + (Math.random()-.5)*48)), cy = Math.max(46, y - 30 - Math.random()*18);
    const node = document.createElement('span');
    node.className = 'comic-word'; node.setAttribute('aria-hidden','true');
    node.style.left = `${cx}px`; node.style.top = `${cy}px`;
    const bg = STICKER_BG[(Math.random()*STICKER_BG.length)|0];
    node.innerHTML = `<svg viewBox="-52 -52 104 104" preserveAspectRatio="none"><polygon points="${burstPoints()}" fill="${bg}" vector-effect="non-scaling-stroke"/></svg><b></b>`;
    node.lastChild.textContent = word;
    document.body.append(node);
    impactRing(x, y);
    const done = () => node.remove();
    try {
      const POP = 'cubic-bezier(.18,.89,.32,1.35)';   // easing is per keyframe: the overshoot only drives the pop-in, the hold and fade stay linear in time
      node.animate([
        {opacity:0,scale:.2,rotate:`${-tilt*1.8}deg`,easing:POP},
        {opacity:1,scale:1.28,rotate:`${tilt}deg`,offset:.34,easing:'ease-out'},
        {opacity:1,scale:.96,rotate:`${tilt*.8}deg`,offset:.5,easing:'ease-out'},
        {opacity:1,scale:1,rotate:`${tilt}deg`,offset:.7,easing:'ease-in'},
        {opacity:0,scale:1.04,rotate:`${tilt}deg`,translate:'0 -16px',offset:1}
      ],{duration:760,easing:'linear'}).onfinish = done;
    } catch (_) { done(); }
    setTimeout(done, 1400);
  }

  /* ---- slider particles: a thin trail behind the thumb while dragging, a burst on release (canvas, no DOM per particle) ---- */
  function sliderTrail(x, y, vx=0, vy=0) {
    if (!motionOn) return;
    const speed = Math.min(1, Math.hypot(vx, vy) / 2.2);          // px per ms
    const back = vx >= 0 ? Math.PI : 0;                             // particles fly out behind the direction of travel
    const n = speed > .55 ? 2 : 1, cfg = SLIDER_FX[(Math.random()*SLIDER_FX.length)|0];
    spawn(x, y, {...cfg, n, a:[back-.6, back+.6], s:(cfg.s||2)*(.8+speed*1.5), vx:0, up:1, dc:Math.max(cfg.dc||.03, .036), spawn:`slider-${cfg.spawn}`}, n);
  }
  function sliderBurst(x, y) {
    if (!motionOn) return;
    spawn(x, y, {n:12, sh:['star','dia','circle'], s:5.5, up:2, g:.18, dc:.05, col:['#ffd400','#ff3b3b','#2ea8ff','#fff'], r:3, rr:3, spawn:'slider-release'});
    impactRing(x, y, 52);
  }

  /* Pointerdown is anticipation only; the single click handler owns button particles. */
  document.addEventListener('pointerdown', e => {
    const unit = e.target.closest('.comic-unit');
    if (!unit || !motionOn) return;
    if (unit.dataset.kind === 'slider') {
      const thumb = unit._thumb;
      if (thumb) try { thumb.animate([{scale:'1 1'},{scale:'.76 1.16',offset:.28},{scale:'1.12 .92',offset:.68},{scale:'1 1'}],{duration:360+(+unit.dataset.index)*7,easing:'cubic-bezier(.18,.89,.32,1.35)'}); } catch (_) {}
    } else {
      unit.classList.remove('hit');
      void unit.offsetWidth;
      unit.classList.add('hit');
      clearTimeout(unit._hitTimer);
      unit._hitTimer = setTimeout(()=>unit.classList.remove('hit'),650);
    }
    debug.lastInteraction = `press:${unit.dataset.kind}-${+unit.dataset.index+1}`;
  }, {passive:true});

  document.addEventListener('click', e => {
    const b = e.target.closest('.bt.comic-unit');
    if (!b) return;
    const i = Math.max(0, +b.dataset.index);
    const r = b.getBoundingClientRect();
    const x = Number.isFinite(e.clientX) && e.clientX ? e.clientX : r.left+r.width/2;
    const y = Number.isFinite(e.clientY) && e.clientY ? e.clientY : r.top+r.height/2;
    spawn(x,y,BUTTON_FX[i]);
    comicWord(x,y);
    debug.lastInteraction = `click:button-${i+1}`;
  });

  function submitFx(form, kind) {
    const i = Math.max(0,+form.dataset.index);
    const r = form.getBoundingClientRect();
    const x = r.left+r.width/2, y = r.top+r.height/2;
    const cfg = kind==='form' ? FORM_FX[i] : SEARCH_FX[i];
    spawn(x,y,cfg);
    if (performance.now() - lastSticker > 500) comicWord(x,y,kind==='form'?['JOINED!','HEARD!','MAIL!','SCOOP!','SIGNED!','HERO UP!','WELCOME!','ACCESS!','CLAIMED!','CASE CLOSED!','NOTED!','UNLEASHED!','DEAL!','DREAM!','TUNED!'][i]:['FOUND IT!','ZOOM!','CHAT!','AHA!','SCAN!','GO!','LOOK!','ZAP!','BINGO!','MATCH!','POW!','PING!','TICKET!','BEAM!','JACKPOT!'][i]);
    spring(form,{duration:440+i*13,from:.92,overshoot:1.04+(i%4)/100,rotate:((i%5)-2)});
    form.classList.add('sent');
    setTimeout(()=>form.classList.remove('sent'),430);
    debug.lastInteraction = `submit:${kind}-${i+1}`;
  }
  document.addEventListener('submit', e => {
    const form = e.target.closest?.('.f.comic-unit,.sb.comic-unit');
    if (form && motionOn) submitFx(form, form.classList.contains('f') ? 'form' : 'search');
  }, true);

  /* Typing systems: 15 independent shakes, letter-hop profiles and word reveals. */
  /* Typing reaction: a very short horizontal nudge of the field itself (never the page) + a quick border flash. Cancels the previous one, so fast typing retriggers cleanly. */
  function shake(el) {
    if (!motionOn || !el || !el.animate) return;
    try {
      el._shk?.cancel();
      const dir = Math.random() < .5 ? -1 : 1, a = 2 + Math.random()*1.5, bc = getComputedStyle(el).borderTopColor;
      el._shk = el.animate([
        {translate:'0 0', borderColor:'#ff3b3b'},
        {translate:`${-dir*a}px 0`, offset:.3},
        {translate:`${dir*a*.7}px 0`, offset:.65},
        {translate:'0 0', borderColor:bc}
      ],{duration:140, easing:'ease-out'});
    } catch (_) {}
  }
  const WORD_START = [
    {transform:'translateY(22px)',filter:'none',letterSpacing:'2px'},
    {transform:'scale(1.4)',filter:'blur(12px)',letterSpacing:'3px'},
    {transform:'scale(0)',filter:'none',letterSpacing:'8px'},
    {transform:'rotate(-90deg) scale(.3)',filter:'none',letterSpacing:'2px'},
    {transform:'translateX(-45px)',filter:'none',letterSpacing:'4px'},
    {transform:'perspective(300px) rotateX(90deg)',filter:'none',letterSpacing:'2px'},
    {transform:'translateY(-30px)',filter:'none',letterSpacing:'1px'},
    {transform:'translateX(-45px)',filter:'blur(3px)',letterSpacing:'5px'},
    {transform:'translateX(45px)',filter:'none',letterSpacing:'-1px'},
    {transform:'skewX(40deg) translateX(30px)',filter:'none',letterSpacing:'2px'},
    {transform:'scale(2.6)',filter:'blur(4px)',letterSpacing:'7px'},
    {transform:'translateY(25px) scale(.5)',filter:'blur(3px)',letterSpacing:'1px'},
    {transform:'scaleX(0)',filter:'none',letterSpacing:'5px'},
    {transform:'translateY(-18px)',filter:'brightness(4) blur(4px)',letterSpacing:'0px'},
    {transform:'rotate(20deg) scale(.6)',filter:'blur(6px)',letterSpacing:'6px'}
  ];
  const previousValues = new WeakMap();
  function pointAtEnd(el) {
    const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
    const ctxMeasure = document.createElement('canvas').getContext('2d');
    ctxMeasure.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const text=el.value.slice(0,el.selectionStart ?? el.value.length);
    const width=ctxMeasure.measureText(text).width+parseFloat(cs.paddingLeft||0)+parseFloat(cs.borderLeftWidth||0);
    return {x:r.left+Math.min(width,r.width-12),y:r.top+r.height/2,r};
  }
  function wordComplete(el, word, index) {
    if (!word || !motionOn) return;
    const r=el.getBoundingClientRect(), profile=WORD_START[index];
    const node=document.createElement('span');
    node.className='wd';node.dataset.wordFx=String(index+1);node.textContent=word;
    node.style.cssText=`left:${r.left+r.width/2}px;top:${r.top-4}px;color:${baseColors[index%baseColors.length]}`;
    document.body.append(node);
    debug.wordFades++;debug.lastInteraction=`word-complete:text-${index+1}`;
    node.animate([
      {opacity:0,transform:profile.transform,filter:profile.filter,letterSpacing:profile.letterSpacing},
      {opacity:1,transform:'translateY(-4px) scale(1.06)',filter:'none',letterSpacing:'2px',offset:.24},
      {opacity:1,transform:'translateY(-4px) scale(1)',filter:'none',letterSpacing:'2px',offset:.72},
      {opacity:0,transform:'translateY(-28px) scale(.96)',filter:'blur(2px)',letterSpacing:'4px',offset:1}
    ],{duration:950+index*19,easing:['cubic-bezier(.2,.8,.2,1)','ease-out','cubic-bezier(.17,.67,.3,1)'][index%3]}).onfinish=()=>node.remove();
  }
  function textInput(el, value, previous, event) {
    const i=Math.max(0,+el.dataset.index);
    const cfg=TEXT_FX[i];
    if (motionOn) {
      shake(el);
      try { el.animate([{filter:'brightness(1)'},{filter:`brightness(${1.06+(i%5)/100})`},{filter:'brightness(1)'}],{duration:150,easing:'ease-out'}); } catch (_) {}
    }
    const p=pointAtEnd(el);
    const char=(event.data && event.data.length===1 && event.data!==' ') ? event.data : null;
    if(char) spawn(p.x,p.y,{...cfg,ch:[char],sz:19+(i%5),n:1},1);
    else spawn(p.x,p.y,cfg,Math.min(4,1+i%4));
    if(char && motionOn) {
      const spark={n:1,sh:['circle','star','line','dia','plus'][i%5],s:.8+(i%4)*.4,up:2+i%6,g:(i%3)*.04,dc:.035+(i%4)*.004,col:[baseColors[i%5]],spawn:`key-tick-${i+1}`,r:1.5,rr:2};
      spawn(p.x,p.y,spark,1);
    }
    const endedWithSpace=value.endsWith(' ') && !previous.endsWith(' ');
    if(endedWithSpace) {
      const caret=el.selectionStart ?? value.length;
      const textBefore=value.slice(0,Math.max(0,caret-1)).trimEnd();
      const completed=textBefore.split(/\s+/).pop();
      if(completed) wordComplete(el,completed,i);
    }
    debug.lastInteraction=`type:text-${i+1}`;
  }
  document.addEventListener('input',e=>{
    const el=e.target;
    if(!el.matches?.('.tb.comic-unit'))return;
    const before=previousValues.get(el) ?? '';
    textInput(el,el.value,before,e);
    previousValues.set(el,el.value);
  });

  /* Forms and searches get their own keystroke particle and shake personality. */
  const fieldShakeCSS = document.createElement('style');
  const fieldShakeRules=[];
  for (let i=0;i<15;i++) {
    const idx=i+1;
    const ax=((idx*5)%13)-6, ay=((idx*7)%9)-4, ar=((idx*3)%11)-5;
    fieldShakeRules.push(`@keyframes fieldShakeF${idx}{0%,100%{translate:0 0;rotate:0deg}24%{translate:${ax}px ${ay}px;rotate:${ar}deg}52%{translate:${-ax*.5}px ${-ay*.6}px;rotate:${-ar*.55}deg}76%{translate:${ax*.2}px 0;rotate:${ar*.2}deg}}`);
    fieldShakeRules.push(`@keyframes fieldShakeS${idx}{0%,100%{translate:0 0;rotate:0deg}18%{translate:${-ay}px ${ax*.3}px;rotate:${-ar}deg}46%{translate:${ay*.35}px ${-ax*.25}px;rotate:${ar*.4}deg}75%{translate:0 0;rotate:${-ar*.2}deg}}`);
  }
  fieldShakeCSS.textContent=fieldShakeRules.join('\n');document.head.append(fieldShakeCSS);
  function fieldParticles(el,e) {
    const form=el.closest('.f'), search=el.closest('.sb');
    if(!form&&!search)return;
    const kind=form?'form':'search';
    const i=Math.max(0,+((form||search).dataset.index));
    const cfg=kind==='form'?FORM_FX[i]:SEARCH_FX[i];
    const p=pointAtEnd(el);
    const ch=e.data&&e.data.length===1&&e.data!==' '?e.data:null;
    const keyCfg={...cfg,n:ch?1:Math.min(3,1+i%3),s:Math.max(1,(cfg.s||4)*.28),up:2+(i%5),dc:.022+(i%4)*.003,spawn:`${kind}-key-${i+1}`,ch:ch?[ch]:null,sz:16+(i%6),col:cfg.col};
    spawn(p.x,p.y,keyCfg,keyCfg.n);
    shake(el);
    debug.lastInteraction=`type:${kind}-${i+1}`;
  }
  document.addEventListener('input',e=>{
    const el=e.target;
    if(!el.matches?.('input,textarea') || el.classList.contains('tb'))return;
    fieldParticles(el,e);
    previousValues.set(el,el.value);
  });

  /* Seeded palette randomizer + theme + motion, exposed to the site header. */
  function mulberry32(a) { return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}; }
  function hsl(h,s,l) { return `hsl(${((h%360)+360)%360} ${s}% ${l}%)`; }
  const setVars=o=>{for(const k in o)root.style.setProperty(k,o[k]);};
  function applyTheme() { root.dataset.theme=theme; localStorage.setItem('srg_theme',theme); }
  function applyPalette(P){
    // kit variables + the site's own accent variables, so every page follows the palette
    setVars({'--y':P.y,'--r':P.r,'--b':P.b,'--g':P.g,'--p':P.p,'--c':P.c,'--bgLight':P.bgL,'--bgDark':P.bgD,'--yellow':P.y,'--red':P.r,'--blue':P.b,'--green':P.g,'--paper':P.bgL});
  }
  function makePalette(newSeed) {
    let mixed=newSeed>>>0;
    mixed^=mixed>>>16;mixed=Math.imul(mixed,0x7feb352d);mixed^=mixed>>>15;mixed=Math.imul(mixed,0x846ca68b);mixed^=mixed>>>16;
    const rand=mulberry32(mixed>>>0);
    paletteHue=Math.floor(rand()*360);
    const sat=78+Math.floor(rand()*18);
    applyPalette({bgL:hsl((paletteHue+8)%360,32+Math.floor(rand()*22),90+Math.floor(rand()*6)),bgD:hsl((paletteHue+220)%360,28+Math.floor(rand()*28),9+Math.floor(rand()*9)),
      c:hsl((paletteHue+18)%360,18+Math.floor(rand()*30),96),y:hsl(paletteHue,sat,56+Math.floor(rand()*11)),r:hsl((paletteHue+320)%360,84+Math.floor(rand()*15),52+Math.floor(rand()*10)),
      b:hsl((paletteHue+178)%360,78+Math.floor(rand()*18),47+Math.floor(rand()*12)),g:hsl((paletteHue+105)%360,62+Math.floor(rand()*24),40+Math.floor(rand()*15)),p:hsl((paletteHue+285)%360,74+Math.floor(rand()*20),60+Math.floor(rand()*14))});
    localStorage.setItem('srg_seed',String(newSeed));
  }
  function setClassicPalette() {
    applyPalette({bgL:'#fff8e1',bgD:'#1a1530',c:'#fffbe8',y:'#ffd900',r:'#d92b2b',b:'#2b80d9',g:'#2ecc71',p:'#ff5fc8'});
    localStorage.removeItem('srg_seed');
  }
  function setMotion(v) {
    motionOn=!!v;
    root.classList.toggle('motion-off',!motionOn);
    if(!motionOn){
      if(raf){cancelAnimationFrame(raf);raf=0;}
      particles=[];ctx.clearRect(0,0,innerWidth,innerHeight);
      $$('.comic-word,.wd,.kb-word').forEach(n=>n.remove());
    }
  }

  /* Accessible focus treatment for child controls inside every form/search component. */
  const finalCSS=document.createElement('style');
  finalCSS.textContent=`
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    .range-value{font:18px Bangers,Impact,sans-serif;letter-spacing:1px;background:#fffbe8;color:#111;border:2px solid #111;padding:3px 10px;min-width:88px;text-align:center;box-shadow:2px 2px 0 #111;clip-path:polygon(3% 0,97% 4%,100% 85%,94% 100%,0 94%);}
    .comic-word{position:fixed;z-index:100;pointer-events:none;translate:-50% -50%;display:grid;place-items:center;padding:.8em 1.25em;font-size:clamp(22px,4.4vw,32px);will-change:scale,rotate,opacity}
    .comic-word svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(3px 3px 0 #111)}
    .comic-word svg polygon{stroke:#111;stroke-width:3.5;stroke-linejoin:round}
    .comic-word b{position:relative;font:400 1em/1 Bangers,Impact,sans-serif;letter-spacing:1.5px;color:#fff;-webkit-text-stroke:2px #111;paint-order:stroke fill;text-shadow:2px 2px 0 #111;white-space:nowrap}
    .comic-ring{position:fixed;z-index:99;pointer-events:none;translate:-50% -50%;border-radius:50%;border:4px solid #111;background:radial-gradient(circle,transparent 58%,rgba(255,212,0,.55) 60%,transparent 74%)}
    .wd{font-size:clamp(23px,4vw,32px);z-index:100;color:var(--r);-webkit-text-stroke:1.5px #111;text-shadow:2px 2px 0 var(--y)}
    .comic-unit{backface-visibility:hidden}
    .motion-off *, .motion-off *::before, .motion-off *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
    .motion-off .comic-unit{will-change:auto!important}
  `;
  document.head.append(finalCSS);

  /* restore saved look, then register what is already on screen and everything React renders later */
  /* the header toggles are gone: always start with the default light theme + classic palette, and drop any old saved choice */
  localStorage.removeItem('srg_theme');localStorage.removeItem('srg_seed');theme='light';applyTheme();
  scan();
  new MutationObserver(ms=>{for(const m of ms){if(m.type==='attributes')scan(m.target);else m.addedNodes.forEach(n=>n.nodeType===1&&scan(n));}})
    .observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});

  Object.defineProperty(debug,'liveParticles',{get:()=>particles.length});
  kitApi = {
    spawn, comicWord, impactRing, sliderTrail, sliderBurst, shake, spring, BUTTON_FX, LOW, setMotion, isMotionOn:()=>motionOn,
    toggleTheme(){theme=theme==='light'?'dark':'light';applyTheme();return theme;},
    getTheme:()=>theme,
    randomizePalette(){seed=(seed+1)>>>0;makePalette(seed);return seed;},
    classicPalette:setClassicPalette,
    getSeed:()=>seed
  };
  window.__comicActions = kitApi;
  return kitApi;
}
