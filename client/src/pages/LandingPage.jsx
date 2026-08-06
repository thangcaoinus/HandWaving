import React from 'react';
import { useNavigate } from 'react-router-dom';
import { generateUniqueId } from '../utils/idGenerator';
import { Pencil, Users, Save, Sparkles, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  const handleStartDrawing = () => {
    const localCanvasId = `local-${generateUniqueId('canvas')}`;
    navigate(`/canvas/${localCanvasId}`);
  };

  const handleLogin = () => navigate('/login');
  const handleRegister = () => navigate('/login?mode=register');

  return (
    <div className="paper-surface min-h-screen relative overflow-hidden font-body text-[color:var(--ink)]">

      {/* Doodles roam the whole paper — ink strokes, like margin scribbles */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g stroke="var(--ink)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.12">
          <circle className="doodle-float" style={{ '--r': '-4deg' }} cx="1230" cy="130" r="30" />
          <path className="doodle-float" style={{ '--r': '5deg' }} d="M120 690 q60 -44 140 -12 M232 656 l32 20 -34 18" />
          <path className="doodle-float" style={{ '--r': '3deg' }} d="M1300 800 l58 -6 l4 62 l-64 8 l-2 -66 z" />
          <path className="doodle-float" style={{ '--r': '-6deg' }} d="M70 300 q40 -28 80 0 t80 0" />
        </g>
        {/* a couple of coral accents so the field isn't pure gray */}
        <g stroke="var(--coral)" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.22">
          <path className="doodle-float" style={{ '--r': '2deg' }} d="M1180 420 l70 40 l-120 16 z" />
          <circle className="doodle-float" style={{ '--r': '-3deg' }} cx="110" cy="560" r="18" />
        </g>
      </svg>

      {/* Content sits directly on the canvas */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-6xl mx-auto px-6 md:px-10 lg:px-16 py-14">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">

              {/* Left: message + actions */}
              <div className="text-center lg:text-left">
                <h1 className="font-display text-[color:var(--coral)] leading-[0.92] text-6xl md:text-7xl lg:text-[7.5rem] mb-6 tracking-tight">
                  HandWaving
                </h1>

                <p className="font-display text-3xl md:text-4xl text-[color:var(--ink)] leading-tight mb-4 max-w-lg mx-auto lg:mx-0">
                  Wave your hand. Get clean shapes.
                </p>
                <p className="font-body text-lg md:text-xl text-[color:var(--ink-soft)] leading-snug mb-9 max-w-lg mx-auto lg:mx-0">
                  Bad handwriting? Mouse-drawing a nightmare? Sketch it however roughly. It snaps the mess into crisp geometry.
                </p>

                {/* Primary CTA — coral, the one loud thing */}
                <button
                  onClick={handleStartDrawing}
                  className="cta-lift focus-sketch sketch-button group bg-[color:var(--coral)] text-white text-xl md:text-2xl px-9 py-4 md:py-5 inline-flex items-center gap-3 shadow-[0_10px_24px_-6px_rgba(216,79,74,0.55)] font-display"
                >
                  <Pencil className="w-6 h-6" strokeWidth={2.5} />
                  Start Sketching
                  <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
                </button>

                <p className="text-base text-[color:var(--ink-soft)] mt-5 flex items-center justify-center lg:justify-start gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  No account needed · Runs in your browser · Instant
                </p>

                {/* Secondary auth — ink-outlined, quiet next to the coral CTA */}
                <div className="flex items-center gap-3 justify-center lg:justify-start mt-8">
                  <span className="text-base text-[color:var(--ink-soft)] hidden sm:inline">Coming back?</span>
                  <button
                    onClick={handleLogin}
                    className="cta-lift focus-sketch sketch-button bg-transparent text-[color:var(--ink)] border-2 border-[color:var(--ink)] px-5 py-2 text-base font-bold font-display hover:bg-[color:var(--ink)] hover:text-[color:var(--paper)] transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={handleRegister}
                    className="cta-lift focus-sketch sketch-button bg-transparent text-[color:var(--coral-deep)] border-2 border-[color:var(--coral)] px-5 py-2 text-base font-bold font-display hover:bg-[color:var(--coral)] hover:text-white transition-colors"
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              {/* Right: the draw -> snap evidence, framed like a torn canvas swatch */}
              <div className="relative mx-auto w-full max-w-md">
                <div className="relative aspect-square rounded-[20px_24px_18px_22px/22px_18px_24px_20px] bg-white/70 backdrop-blur-[1px] border-2 border-[color:var(--ink)]/12 shadow-[0_18px_40px_-12px_rgba(44,42,40,0.22)] overflow-hidden">
                  {/* the swatch's own faint grid */}
                  <div className="absolute inset-0 opacity-[0.05]" style={{
                    backgroundImage: 'linear-gradient(var(--ink) 1px, transparent 1px), linear-gradient(90deg, var(--ink) 1px, transparent 1px)',
                    backgroundSize: '30px 30px'
                  }} />
                  <DrawSnapHero />
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-sm font-display text-[color:var(--ink-soft)] whitespace-nowrap">
                    rough in · clean out
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature row — sits low on the paper, ink text, hand-drawn divider */}
        <div className="w-full max-w-6xl mx-auto px-6 md:px-10 lg:px-16 pb-16">
          <svg className="w-full h-3 mb-9 text-[color:var(--ink)]/15" preserveAspectRatio="none" viewBox="0 0 1000 12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M0 7 q60 -6 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-12">
            <Feature
              icon={<Sparkles className="w-6 h-6" strokeWidth={2.5} />}
              title="Smart shapes"
              body="Draw loose. Circles, rectangles, triangles and arrows snap crisp on their own."
            />
            <Feature
              icon={<Users className="w-6 h-6" strokeWidth={2.5} />}
              title="Draw together"
              body="Live cursors, presence, and conflict-free sync so a whole room can sketch at once."
            />
            <Feature
              icon={<Save className="w-6 h-6" strokeWidth={2.5} />}
              title="Local-first"
              body="Runs entirely in your browser. Add an account to sync and collaborate later."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Feature — coral icon badge, ink display title, ink-soft body. No card. */
function Feature({ icon, title, body }) {
  return (
    <div className="text-center sm:text-left group">
      <div className="inline-flex items-center justify-center w-12 h-12 mb-3 rounded-[14px_11px_13px_10px/12px_13px_10px_14px] bg-[color:var(--coral)]/12 text-[color:var(--coral)] transition-transform group-hover:-rotate-6">
        {icon}
      </div>
      <h3 className="font-display text-2xl text-[color:var(--ink)] mb-1">{title}</h3>
      <p className="font-body text-base text-[color:var(--ink-soft)] leading-relaxed max-w-[28ch] mx-auto sm:mx-0">{body}</p>
    </div>
  );
}

/* Evidence: a pencil-ink rough stroke draws itself, then the coral clean shape
   snaps over it — the exact "rough in, clean out" promise. Three shapes cycle. */
function DrawSnapHero() {
  const ink = '#8a8580';   // pencil gray — a rough sketch, not final ink
  const coral = '#f0685f'; // the smart-shape payoff
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" aria-label="A hand-drawn stroke snapping into a clean shape">
      {/* Cell 1 — squiggle -> circle */}
      <g className="hero-cell-1">
        <path
          className="hero-rough"
          style={{ '--len': 560 }}
          d="M150 78 c-44 0 -74 30 -74 72 c0 44 34 72 74 72 c42 0 76 -30 74 -74 c-2 -40 -30 -68 -70 -70 c-8 0 -16 2 -22 6"
          fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round"
        />
        <circle className="hero-clean" cx="150" cy="150" r="72" fill="none" stroke={coral} strokeWidth="7" />
      </g>

      {/* Cell 2 — wobbly box -> rectangle */}
      <g className="hero-cell-2">
        <path
          className="hero-rough"
          style={{ '--len': 620 }}
          d="M80 92 l142 -4 l4 118 l-148 6 l-2 -122 l6 0"
          fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
        />
        <rect className="hero-clean" x="82" y="94" width="140" height="112" rx="4" fill="none" stroke={coral} strokeWidth="7" />
      </g>

      {/* Cell 3 — scrawled arrow -> clean arrow */}
      <g className="hero-cell-3">
        <path
          className="hero-rough"
          style={{ '--len': 340 }}
          d="M66 178 q70 -68 150 -44 M188 116 l30 18 -14 32"
          fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
        />
        <path className="hero-clean" d="M70 180 q68 -60 148 -44 M192 118 l28 18 -14 30" fill="none" stroke={coral} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
