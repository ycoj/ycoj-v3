type DecoratedFrameId = 'frame-tiger' | 'frame-pixel';

// The decoration is drawn on a 100-unit square that matches the avatar and
// extends 14 units past each edge, leaving room for ears and blocks.
const VIEW_BOX = '-14 -14 128 128';
const CENTER = 50;

const TIGER_STRIPE_ANGLES = [-90, -66, -114, -20, 20, 160, 200, 60, 120];

function polar(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  };
}

const tigerStripes = TIGER_STRIPE_ANGLES.map((angle) => ({
  angle,
  from: polar(angle, 50.5),
  to: polar(angle, 56.5),
}));

const PIXEL_SIZE = 6;
const GRASS_SHADES = ['#5fa339', '#4c8a2e', '#74b84a'];
const DIRT_SHADES = ['#8b5a2b', '#74491f', '#a06a38'];

// Blocks sit on a fixed grid so the ring stays stable between renders: grass
// across the top, dirt below.
const pixelBlocks = (() => {
  const blocks: { x: number; y: number; fill: string }[] = [];
  for (let row = -2; row < 20; row += 1) {
    for (let col = -2; col < 20; col += 1) {
      const x = col * PIXEL_SIZE;
      const y = row * PIXEL_SIZE;
      const distance = Math.hypot(
        x + PIXEL_SIZE / 2 - CENTER,
        y + PIXEL_SIZE / 2 - CENTER
      );
      if (distance < 51 || distance >= 59) continue;
      const shades = y + PIXEL_SIZE / 2 < 40 ? GRASS_SHADES : DIRT_SHADES;
      blocks.push({ x, y, fill: shades[(row * 7 + col * 3 + 99) % 3] });
    }
  }
  return blocks;
})();

function TigerFrame() {
  return (
    <>
      {[false, true].map((mirrored) => (
        <g
          key={String(mirrored)}
          transform={mirrored ? 'translate(100 0) scale(-1 1)' : undefined}
        >
          <polygon
            points="4,32 6,-8 42,8"
            fill="#f97316"
            stroke="#7c2d12"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <polygon points="13,24 14,3 31,11" fill="#fdba74" />
        </g>
      ))}
      <circle
        cx={CENTER}
        cy={CENTER}
        r="53"
        fill="none"
        stroke="#f97316"
        strokeWidth="6"
      />
      {tigerStripes.map(({ angle, from, to }) => (
        <line
          key={angle}
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke="#431407"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

function PixelFrame() {
  return (
    <g shapeRendering="crispEdges">
      {pixelBlocks.map(({ x, y, fill }) => (
        <rect
          key={`${x}:${y}`}
          x={x}
          y={y}
          width={PIXEL_SIZE}
          height={PIXEL_SIZE}
          fill={fill}
        />
      ))}
    </g>
  );
}

export function isDecoratedFrame(id?: string): id is DecoratedFrameId {
  return id === 'frame-tiger' || id === 'frame-pixel';
}

/** Artwork drawn behind an avatar. The avatar root must establish a stacking context. */
export default function RewardFrameDecoration({
  id,
}: {
  id: DecoratedFrameId;
}) {
  return (
    <svg
      viewBox={VIEW_BOX}
      aria-hidden="true"
      focusable="false"
      data-reward-frame={id}
      className="pointer-events-none absolute -top-[14%] -left-[14%] -z-10 size-[128%] max-w-none"
    >
      {id === 'frame-tiger' ? <TigerFrame /> : <PixelFrame />}
    </svg>
  );
}
