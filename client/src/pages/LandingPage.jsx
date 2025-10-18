import React from 'react';
import { useNavigate } from 'react-router-dom';
import { generateUniqueId } from '../utils/idGenerator';
import { Pencil, Users, Save, Sparkles } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  const handleStartDrawing = () => {
    // Create local canvas ID
    const localCanvasId = `local-${generateUniqueId('canvas')}`;
    navigate(`/canvas/${localCanvasId}`);
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleRegister = () => {
    navigate('/login?mode=register');
  };

  return (
    <div className="h-screen bg-gradient-to-br from-[#f08080] via-[#f8ad9d] to-[#ffdab9] flex items-center justify-center p-4 md:p-6 lg:p-8 overflow-hidden relative">
      {/* Drawing tool doodles floating in the background - organized symmetrically */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-15" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        {/* Top left corner - Pencil */}
        <g transform="translate(100, 80) rotate(-35)">
          <rect x="0" y="0" width="12" height="80" fill="#ffd700" stroke="#000" strokeWidth="2"/>
          <polygon points="6,80 0,95 12,95" fill="#f4a460" stroke="#000" strokeWidth="2"/>
          <polygon points="6,95 3,100 9,100" fill="#333" />
          <rect x="0" y="5" width="12" height="8" fill="#ffb6c1" />
        </g>

        {/* Top right corner - Eraser */}
        <g transform="translate(1450, 80) rotate(35)">
          <rect x="0" y="0" width="50" height="30" rx="4" fill="#ffb6c1" stroke="#000" strokeWidth="2"/>
          <rect x="5" y="5" width="40" height="20" fill="#ffc0cb" />
        </g>

        {/* Left side - Ruler (vertical) */}
        <g transform="translate(60, 450) rotate(-90)">
          <rect x="0" y="0" width="120" height="25" fill="#87ceeb" stroke="#000" strokeWidth="2"/>
          <line x1="10" y1="0" x2="10" y2="10" stroke="#000" strokeWidth="1"/>
          <line x1="30" y1="0" x2="30" y2="15" stroke="#000" strokeWidth="1"/>
          <line x1="50" y1="0" x2="50" y2="10" stroke="#000" strokeWidth="1"/>
          <line x1="70" y1="0" x2="70" y2="15" stroke="#000" strokeWidth="1"/>
          <line x1="90" y1="0" x2="90" y2="10" stroke="#000" strokeWidth="1"/>
          <line x1="110" y1="0" x2="110" y2="15" stroke="#000" strokeWidth="1"/>
        </g>

        {/* Right side - Marker (vertical) */}
        <g transform="translate(1500, 450) rotate(90)">
          <rect x="0" y="0" width="15" height="70" fill="#9370db" stroke="#000" strokeWidth="2"/>
          <polygon points="7.5,70 3,80 12,80" fill="#333" stroke="#000" strokeWidth="2"/>
          <rect x="0" y="3" width="15" height="12" fill="#fff" />
          <circle cx="7.5" cy="9" r="3" fill="#9370db" />
        </g>

        {/* Bottom left corner - Pen */}
        <g transform="translate(120, 780) rotate(-35)">
          <rect x="0" y="0" width="10" height="75" fill="#000" stroke="#333" strokeWidth="1"/>
          <polygon points="5,75 2,85 8,85" fill="#silver" stroke="#000" strokeWidth="1"/>
          <rect x="0" y="2" width="10" height="15" fill="#4169e1" />
          <circle cx="5" cy="10" r="2" fill="#fff" />
        </g>

        {/* Bottom right corner - Crayon */}
        <g transform="translate(1430, 790) rotate(35)">
          <rect x="0" y="0" width="18" height="65" rx="2" fill="#ff69b4" stroke="#000" strokeWidth="2"/>
          <polygon points="9,65 4,78 14,78" fill="#ff1493" stroke="#000" strokeWidth="2"/>
          <text x="4" y="15" fontSize="10" fill="#fff" fontFamily="Arial">C</text>
        </g>
      </svg>

      {/* Single unified canvas panel */}
      <div className="max-w-5xl w-full h-full max-h-[min(90vh,900px)] flex items-center justify-center relative z-10">
        <div className="sketch-panel bg-white relative overflow-hidden w-full" style={{
          boxShadow: `
            0 2px 4px rgba(0,0,0,0.1),
            0 4px 8px rgba(0,0,0,0.1),
            0 8px 16px rgba(0,0,0,0.15),
            0 16px 24px rgba(0,0,0,0.15),
            inset 0 -2px 4px rgba(0,0,0,0.05)
          `
        }}>
          {/* Canvas texture/grid subtle background */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `
              linear-gradient(0deg, transparent 24%, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.05) 26%, transparent 27%, transparent 74%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0.05) 76%, transparent 77%, transparent),
              linear-gradient(90deg, transparent 24%, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.05) 26%, transparent 27%, transparent 74%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0.05) 76%, transparent 77%, transparent)
            `,
            backgroundSize: '50px 50px'
          }}></div>

          {/* Playful doodles scattered across the canvas - LOTS MORE! */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10" xmlns="http://www.w3.org/2000/svg">
            {/* Top left area */}
            <circle cx="8%" cy="12%" r="25" fill="none" stroke="#f08080" strokeWidth="3" />
            <rect x="48" y="72" width="30" height="25" fill="none" stroke="#ffa07a" strokeWidth="2.5" transform="rotate(-12 80 90)" />
            <path d="M 240 162 L 288 126 L 336 162 Z" fill="none" stroke="#f8ad9d" strokeWidth="2.5" />

            {/* Top center */}
            <circle cx="45%" cy="8%" r="20" fill="none" stroke="#fbc4ab" strokeWidth="3" />
            <path d="M 608 135 Q 640 108 672 135 T 736 135" fill="none" stroke="#f08080" strokeWidth="2.5" />
            <rect x="800" y="45" width="35" height="20" fill="none" stroke="#ffa07a" strokeWidth="2.5" transform="rotate(8 832 72)" />

            {/* Top right area */}
            <circle cx="75%" cy="10%" r="22" fill="none" stroke="#f8ad9d" strokeWidth="3" />
            <path d="M 1312 135 L 1472 135 M 1424 108 L 1472 135 L 1424 162" fill="none" stroke="#f08080" strokeWidth="3" />
            <path d="M 1408 72 L 1520 108 L 1456 162 Z" fill="none" stroke="#fbc4ab" strokeWidth="2.5" />

            {/* Left side middle */}
            <path d="M 80 315 L 192 270 L 224 342 Z" fill="none" stroke="#f08080" strokeWidth="2.5" transform="rotate(-5 128 315)" />
            <rect x="48" y="378" width="40" height="30" fill="none" stroke="#ffa07a" strokeWidth="3" transform="rotate(-8 112 423)" />
            <circle cx="10%" cy="60%" r="18" fill="none" stroke="#f8ad9d" strokeWidth="2.5" />

            {/* Center area */}
            <path d="M 672 360 Q 720 342 768 360 T 864 360" fill="none" stroke="#fbc4ab" strokeWidth="3" />
            <circle cx="55%" cy="52%" r="28" fill="none" stroke="#f08080" strokeWidth="2.5" />
            <rect x="560" y="522" width="38" height="32" fill="none" stroke="#f8ad9d" strokeWidth="2.5" transform="rotate(5 640 558)" />

            {/* Right side middle */}
            <path d="M 1360 315 L 1440 360 L 1312 378 Z" fill="none" stroke="#ffa07a" strokeWidth="2.5" />
            <circle cx="92%" cy="48%" r="24" fill="none" stroke="#f08080" strokeWidth="3" />
            <path d="M 1360 495 Q 1408 468 1456 495 T 1520 522" fill="none" stroke="#fbc4ab" strokeWidth="3" />
            <rect x="1312" y="540" width="32" height="28" fill="none" stroke="#f8ad9d" strokeWidth="2.5" transform="rotate(-10 1408 585)" />

            {/* Bottom left area */}
            <circle cx="8%" cy="75%" r="26" fill="none" stroke="#fbc4ab" strokeWidth="3" />
            <path d="M 240 738 L 352 693 L 384 765 Z" fill="none" stroke="#f08080" strokeWidth="2.5" />
            <rect x="48" y="792" width="35" height="25" fill="none" stroke="#ffa07a" strokeWidth="2.5" transform="rotate(6 128 828)" />

            {/* Bottom center */}
            <path d="M 640 765 L 768 765 M 720 738 L 768 765 L 720 792" fill="none" stroke="#f8ad9d" strokeWidth="3" />
            <circle cx="52% " cy="78%" r="20" fill="none" stroke="#f08080" strokeWidth="2.5" />
            <path d="M 560 828 L 672 792 L 720 846 Z" fill="none" stroke="#fbc4ab" strokeWidth="2.5" />

            {/* Bottom right area */}
            <path d="M 1248 675 L 1344 738 L 1152 756 Z" fill="none" stroke="#f08080" strokeWidth="3" />
            <circle cx="88%" cy="80%" r="23" fill="none" stroke="#ffa07a" strokeWidth="3" />
            <rect x="1200" y="792" width="36" height="24" fill="none" stroke="#f8ad9d" strokeWidth="2.5" transform="rotate(-7 1218 804)" />
            <path d="M 1440 810 Q 1472 792 1504 810 T 1536 846" fill="none" stroke="#fbc4ab" strokeWidth="2.5" />

            {/* Extra scattered small elements */}
            <circle cx="25%" cy="30%" r="15" fill="none" stroke="#f08080" strokeWidth="2" />
            <path d="M 1088 225 L 1152 225 L 1120 270 Z" fill="none" stroke="#ffa07a" strokeWidth="2" />
            <circle cx="30%" cy="72%" r="16" fill="none" stroke="#f8ad9d" strokeWidth="2" />
            <path d="M 992 612 L 1056 630 L 1008 666 Z" fill="none" stroke="#fbc4ab" strokeWidth="2" />
          </svg>

          <div className="relative z-10 px-6 md:px-10 lg:px-12 py-8 md:py-10 lg:py-12 text-center">
            {/* Title */}
            <div className="mb-4 md:mb-6">
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#f08080]"
                style={{ fontFamily: 'Comic Sans MS, cursive' }}
              >
                HandWaving
              </h1>
            </div>

            {/* Tagline */}
            <p
              className="text-base md:text-lg lg:text-xl mb-6 md:mb-8 text-gray-700 leading-relaxed max-w-2xl mx-auto"
              style={{ fontFamily: 'Comic Sans MS, cursive' }}
            >
              Draw freely and watch your sketches transform into <span className="text-[#f08080] font-bold">smart shapes!</span>
            </p>

            {/* Primary CTA */}
            <button
              onClick={handleStartDrawing}
              className="sketch-button bg-gradient-to-r from-[#f08080] to-[#ffa07a] text-white text-xl md:text-2xl px-8 md:px-12 py-4 md:py-6 mb-4 hover:scale-105 active:scale-95 transition-transform shadow-lg flex items-center gap-3 mx-auto"
              style={{ fontFamily: 'Comic Sans MS, cursive' }}
            >
              <Pencil className="w-6 h-6 md:w-7 md:h-7" strokeWidth={2.5} />
              Start Drawing Now
            </button>

            <p className="text-xs md:text-sm text-gray-500 mb-6 md:mb-8 flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
              <span>No account needed • Instant access • Auto-saves</span>
            </p>

            {/* Divider line */}
            <div className="relative mb-6 md:mb-8">
              <svg className="w-full h-2" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                <path
                  d="M 0,4 Q 100,2 200,4 T 400,4 T 600,4 T 800,4 T 1000,4"
                  fill="none"
                  stroke="#e0e0e0"
                  strokeWidth="2"
                />
              </svg>
            </div>

            {/* Feature highlights in a row */}
            <div className="grid grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
              <div className="flex flex-col items-center">
                <div className="mb-2 md:mb-3 p-2 md:p-3 rounded-full bg-[#f08080]/10">
                  <Sparkles className="w-7 h-7 md:w-9 md:h-9 text-[#f08080]" strokeWidth={2.5} />
                </div>
                <div className="text-sm md:text-base font-bold mb-1" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
                  Smart Shapes
                </div>
                <div className="text-xs md:text-sm text-gray-600 hidden md:block" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
                  Auto-detect circles, arrows & more
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="mb-2 md:mb-3 p-2 md:p-3 rounded-full bg-[#f8ad9d]/10">
                  <Users className="w-7 h-7 md:w-9 md:h-9 text-[#f8ad9d]" strokeWidth={2.5} />
                </div>
                <div className="text-sm md:text-base font-bold mb-1" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
                  Real-time Collab
                </div>
                <div className="text-xs md:text-sm text-gray-600 hidden md:block" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
                  Draw together instantly
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="mb-2 md:mb-3 p-2 md:p-3 rounded-full bg-[#ffa07a]/10">
                  <Save className="w-7 h-7 md:w-9 md:h-9 text-[#ffa07a]" strokeWidth={2.5} />
                </div>
                <div className="text-sm md:text-base font-bold mb-1" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
                  Auto-save
                </div>
                <div className="text-xs md:text-sm text-gray-600 hidden md:block" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
                  Never lose your work
                </div>
              </div>
            </div>

            {/* Auth buttons */}
            <div className="flex gap-3 md:gap-4 justify-center">
              <button
                onClick={handleLogin}
                className="sketch-button bg-white text-[#f08080] border-2 md:border-3 border-[#f08080] px-6 md:px-8 py-2 md:py-3 text-base md:text-lg hover:bg-[#f08080] hover:text-white transition-colors font-bold"
                style={{ fontFamily: 'Comic Sans MS, cursive' }}
              >
                Login
              </button>

              <button
                onClick={handleRegister}
                className="sketch-button bg-gradient-to-r from-[#f8ad9d] to-[#fbc4ab] text-white border-2 md:border-3 border-[#f08080] px-6 md:px-8 py-2 md:py-3 text-base md:text-lg hover:from-[#f08080] hover:to-[#f8ad9d] transition-all font-bold shadow-md"
                style={{ fontFamily: 'Comic Sans MS, cursive' }}
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
