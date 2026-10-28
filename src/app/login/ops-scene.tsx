/**
 * Isometric operations landscape for the sign-in hero: a request travels from a preschool centre through approval,
 * purchasing, delivery and finance to the executive view. Pure SVG built from the design tokens, so it themes with the
 * app and costs no JavaScript; motion is CSS (entrances, parallax via --px/--py) plus three SMIL packets on the path.
 */
type V3 = readonly [number, number, number];

const COS = Math.cos(Math.PI / 6);
const U = 24; // px per world unit
const P = (x: number, y: number, z = 0) => [(x - y) * COS * U, (x + y) * 0.5 * U - z * U] as const;
const pts = (a: V3[]) => a.map(([x, y, z]) => P(x, y, z).map((n) => n.toFixed(1)).join(",")).join(" ");
const SHADE = "#14233a"; // blue-black, so shadowed faces read cool rather than grey
const mix = (c: string, pct: number) => `color-mix(in oklab, ${c} ${pct}%, ${SHADE})`;

function Box({ x, y, z = 0, w, d, h, color, edge = false }: { x: number; y: number; z?: number; w: number; d: number; h: number; color: string; edge?: boolean }) {
  const top = pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]);
  const left = pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]);
  const right = pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]);
  const stroke = edge ? { stroke: "color-mix(in oklab, var(--line-strong) 80%, transparent)", strokeWidth: 0.6 } : {};
  return (
    <g strokeLinejoin="round">
      <polygon points={left} style={{ fill: mix(color, 84), ...stroke }} />
      <polygon points={right} style={{ fill: mix(color, 70), ...stroke }} />
      <polygon points={top} style={{ fill: color, ...stroke }} />
    </g>
  );
}

/** Soft contact shadow on the floor under an object. */
const Shadow = ({ x, y, w, d }: { x: number; y: number; w: number; d: number }) => (
  <polygon points={pts([[x - 0.15, y - 0.15, 0.4], [x + w + 0.45, y - 0.15, 0.4], [x + w + 0.45, y + d + 0.45, 0.4], [x - 0.15, y + d + 0.45, 0.4]])} style={{ fill: SHADE, opacity: 0.1, filter: "blur(3px)" }} />
);

interface Station { key: string; title: string; detail: string; tone: string; top: number; draw: (x: number, y: number) => React.ReactNode }

const F = 0.4; // floor thickness; objects stand on z = F

/* Objects are drawn around their station centre (x, y). `top` is the object height in world units, for the card leader. */
const STATIONS: Station[] = [
  {
    key: "centre", title: "Baner centre", detail: "Voice request recorded", tone: "var(--orange)", top: 2.4,
    draw: (x, y) => <>
      <Shadow x={x - 1} y={y - 0.85} w={2} d={1.7} />
      <Box x={x - 1} y={y - 0.85} z={F} w={2} d={1.7} h={1.25} color="var(--surface)" edge />
      {[0.3, 1.1].map((o) => <polygon key={o} points={pts([[x - 1 + o, y + 0.85, F + 0.35], [x - 0.5 + o, y + 0.85, F + 0.35], [x - 0.5 + o, y + 0.85, F + 0.85], [x - 1 + o, y + 0.85, F + 0.85]])} style={{ fill: "var(--blue-soft)" }} />)}
      <polygon points={pts([[x + 1, y - 0.55, F], [x + 1, y - 0.05, F], [x + 1, y - 0.05, F + 0.75], [x + 1, y - 0.55, F + 0.75]])} style={{ fill: "var(--orange)", opacity: 0.85 }} />
      <Box x={x - 1.15} y={y - 1} z={F + 1.25} w={2.3} d={2} h={0.3} color="var(--orange)" />
      <Box x={x + 0.25} y={y - 0.6} z={F + 1.55} w={0.35} d={0.35} h={0.5} color="var(--amber)" />
    </>,
  },
  {
    key: "request", title: "Monthly request", detail: "7 items · AI draft", tone: "var(--blue)", top: 1.3,
    draw: (x, y) => <>
      <Shadow x={x - 0.75} y={y - 0.6} w={1.5} d={1.2} />
      {[0, 1, 2].map((i) => <Box key={i} x={x - 0.75 + i * 0.08} y={y - 0.6 - i * 0.08} z={F + i * 0.22} w={1.5} d={1.2} h={0.16} color="var(--surface)" edge />)}
      <Box x={x - 0.5} y={y - 0.72} z={F + 0.6} w={0.9} d={0.22} h={0.06} color="var(--blue)" />
    </>,
  },
  {
    key: "approval", title: "Head Office", detail: "Approved · 1 edit", tone: "var(--blue)", top: 3.1,
    draw: (x, y) => <>
      <Shadow x={x - 0.75} y={y - 0.75} w={1.5} d={1.5} />
      <Box x={x - 0.75} y={y - 0.75} z={F} w={1.5} d={1.5} h={2.4} color="var(--blue)" />
      {[0.55, 1.05, 1.55, 2.05].map((zz) => <Box key={zz} x={x - 0.75} y={y - 0.75} z={F + zz} w={1.5} d={1.5} h={0.04} color="var(--blue-soft)" />)}
      <Box x={x - 0.4} y={y - 0.4} z={F + 2.4} w={0.8} d={0.8} h={0.35} color="var(--secondary-card)" />
    </>,
  },
  {
    key: "purchasing", title: "Purchasing", detail: "5 POs issued", tone: "var(--amber)", top: 1.6,
    draw: (x, y) => <>
      <Shadow x={x - 0.9} y={y - 0.75} w={1.8} d={1.5} />
      <Box x={x - 0.9} y={y - 0.75} z={F} w={0.9} d={1.5} h={0.8} color="var(--amber)" />
      <Box x={x} y={y - 0.75} z={F} w={0.9} d={0.75} h={0.8} color="var(--amber)" />
      <Box x={x} y={y} z={F} w={0.9} d={0.75} h={0.55} color="var(--orange)" />
      <Box x={x - 0.75} y={y - 0.55} z={F + 0.8} w={0.9} d={0.9} h={0.7} color="var(--amber)" />
    </>,
  },
  {
    key: "delivery", title: "Deliveries", detail: "Received at Baner", tone: "var(--green)", top: 1.5,
    draw: (x, y) => <>
      <Shadow x={x - 1.15} y={y - 0.55} w={2.3} d={1.1} />
      <Box x={x - 1.15} y={y - 0.55} z={F + 0.2} w={1.6} d={1.1} h={1.05} color="var(--surface)" edge />
      <Box x={x + 0.45} y={y - 0.55} z={F + 0.2} w={0.7} d={1.1} h={0.75} color="var(--blue)" />
      {[-0.8, 0.15, 0.8].map((wx) => { const [ex, ey] = P(x + wx, y + 0.55, F + 0.12); return <ellipse key={wx} cx={ex} cy={ey} rx="5" ry="3.4" style={{ fill: SHADE, opacity: 0.85 }} />; })}
    </>,
  },
  {
    key: "finance", title: "Finance", detail: "3-way matched", tone: "var(--green)", top: 1.3,
    draw: (x, y) => <>
      <Shadow x={x - 0.75} y={y - 0.7} w={1.5} d={1.4} />
      <Box x={x - 0.75} y={y - 0.7} z={F} w={1.5} d={1.4} h={0.12} color="var(--surface)" edge />
      {[0, 1, 2, 3].map((i) => <Box key={i} x={x - 0.5} y={y - 0.45} z={F + 0.12 + i * 0.22} w={0.75} d={0.75} h={0.18} color="var(--green)" />)}
      <Box x={x + 0.35} y={y - 0.05} z={F + 0.12} w={0.3} d={0.6} h={0.5} color="var(--green-soft)" />
    </>,
  },
  {
    key: "executive", title: "Executive view", detail: "Spend vs budget", tone: "var(--violet)", top: 3.3,
    draw: (x, y) => <>
      <Shadow x={x - 0.65} y={y - 0.65} w={1.3} d={1.3} />
      <Box x={x - 0.65} y={y - 0.65} z={F} w={1.3} d={1.3} h={0.55} color="var(--violet)" />
      <Box x={x - 0.95} y={y - 0.95} z={F + 1.3} w={1.9} d={1.9} h={0.1} color="var(--surface)" edge />
      {([[0.2, 0.9, "var(--blue)"], [0.6, 1.4, "var(--violet)"], [1.0, 0.7, "var(--green)"], [1.4, 1.15, "var(--blue)"]] as const).map(([o, h, c]) => (
        <Box key={o} x={x - 0.8 + o} y={y - 0.1} z={F + 1.4} w={0.26} d={0.26} h={h} color={c} />
      ))}
    </>,
  },
];

/* Screen layout: stations step left → right 78px apart, alternating back and front rows, so each floating card has
   its own column of air. Tall objects (Head Office, Executive) sit on the back row, short ones in front. */
const SPACING = 78, BACK_Y = 150, FRONT_Y = 225;
const PLACED = STATIONS.map((s, i) => {
  const X = (i - (STATIONS.length - 1) / 2) * SPACING;
  const Y = i % 2 === 0 ? BACK_Y : FRONT_Y;
  const diff = X / (COS * U), sum = (Y + F * U) / (0.5 * U); // invert P at z = F
  return { ...s, x: (sum + diff) / 2, y: (sum - diff) / 2 };
});

/** Catmull–Rom through the station feet, as cubic Béziers: one continuous path for the flow line and the packets. */
function flowPath() {
  const p = PLACED.map((s) => P(s.x, s.y, F + 0.02));
  let d = `M${p[0]![0].toFixed(1)} ${p[0]![1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!, p1 = p[i]!, p2 = p[i + 1]!, p3 = p[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]!.toFixed(1)} ${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)} ${c2[1]!.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

const CARD_W = 104, CARD_H = 40;

export function OpsScene() {
  const path = flowPath();
  // Floor slab and its top-face grid.
  const fx0 = Math.min(...PLACED.map((s) => s.x)) - 1.1, fx1 = Math.max(...PLACED.map((s) => s.x)) + 1.1;
  const fy0 = Math.min(...PLACED.map((s) => s.y)) - 1.1, fy1 = Math.max(...PLACED.map((s) => s.y)) + 1.1;
  const grid: string[] = [];
  for (let gx = fx0 + 1; gx < fx1; gx++) grid.push(`M${P(gx, fy0, F).join(" ")} L${P(gx, fy1, F).join(" ")}`);
  for (let gy = fy0 + 1; gy < fy1; gy++) grid.push(`M${P(fx0, gy, F).join(" ")} L${P(fx1, gy, F).join(" ")}`);
  const ordered = [...PLACED].sort((a, b) => a.x + a.y - (b.x + b.y));

  return (
    <svg viewBox="-318 -16 636 372" className="ops-scene h-full w-full" role="img" aria-label="A request moving from a Jumpstart centre through Head Office approval, purchasing, delivery and finance to the executive view">
      <defs>
        <linearGradient id="flow-grad" x1="0" x2="1">
          <stop offset="0" stopColor="var(--orange)" />
          <stop offset="0.45" stopColor="var(--blue)" />
          <stop offset="1" stopColor="var(--violet)" />
        </linearGradient>
      </defs>

      <g className="scene-layer" style={{ "--depth": 0.35 } as React.CSSProperties}>
        <g className="scene-in" style={{ animationDelay: "60ms" }}>
          <Box x={fx0} y={fy0} w={fx1 - fx0} d={fy1 - fy0} h={F} color="var(--surface)" />
          <path d={grid.join(" ")} style={{ stroke: "var(--line)", strokeWidth: 0.7, opacity: 0.8 }} />
        </g>
        <path d={path} fill="none" style={{ stroke: "var(--blue)", strokeWidth: 12, opacity: 0.08, strokeLinecap: "round" }} className="scene-in" />
        <path d={path} fill="none" pathLength={1} stroke="url(#flow-grad)" strokeWidth="2.2" strokeLinecap="round" className="scene-path" />
      </g>

      <g className="scene-layer" style={{ "--depth": 0.7 } as React.CSSProperties}>
        {ordered.map((s) => (
          <g key={s.key} className="scene-in scene-rise" style={{ animationDelay: `${260 + PLACED.indexOf(s) * 110}ms` }}>{s.draw(s.x, s.y)}</g>
        ))}
        {/* Requests in transit. Hidden under reduced motion. */}
        <g className="scene-packets">
          {["var(--orange)", "var(--blue)", "var(--violet)"].map((c, i) => (
            // Hidden until its motion begins; otherwise it would sit at the SVG origin during the delay.
            <g key={c} visibility="hidden">
              <set attributeName="visibility" to="visible" begin={`${1.8 + i * 2.5}s`} />
              <circle r="7" style={{ fill: c, opacity: 0.18 }}>
                <animateMotion dur="7.5s" begin={`${1.8 + i * 2.5}s`} repeatCount="indefinite" path={path} calcMode="linear" />
              </circle>
              <circle r="3.4" style={{ fill: c, stroke: "var(--surface)", strokeWidth: 1.5 }}>
                <animateMotion dur="7.5s" begin={`${1.8 + i * 2.5}s`} repeatCount="indefinite" path={path} calcMode="linear" />
              </circle>
            </g>
          ))}
        </g>
      </g>

      <g className="scene-layer" style={{ "--depth": 1.15 } as React.CSSProperties}>
        {PLACED.map((s, i) => {
          const [ax, ay] = P(s.x, s.y, F + s.top);
          const cx = ax - CARD_W / 2, cy = ay - CARD_H - 16;
          return (
            <g key={s.key} className="scene-in scene-card" style={{ animationDelay: `${780 + i * 90}ms` }}>
              <line x1={ax} y1={ay - 2} x2={ax} y2={cy + CARD_H} style={{ stroke: s.tone, strokeWidth: 1, opacity: 0.55 }} strokeDasharray="2 2" />
              <circle cx={ax} cy={ay - 2} r="2" style={{ fill: s.tone }} />
              <g className="scene-bob" style={{ animationDelay: `${i * -0.9}s` }}>
                <rect x={cx} y={cy} width={CARD_W} height={CARD_H} rx="11" style={{ fill: "color-mix(in oklab, var(--surface) 94%, transparent)", stroke: "color-mix(in oklab, var(--line-strong) 80%, transparent)", strokeWidth: 0.8, filter: "drop-shadow(0 6px 10px rgb(20 35 58 / 0.12))" }} />
                <rect x={cx + 10} y={cy + 11} width="4" height="18" rx="2" style={{ fill: s.tone }} />
                <text x={cx + 21} y={cy + 17.5} style={{ fill: "var(--ink)", fontSize: 10.5, fontWeight: 600, letterSpacing: "-0.01em" }}>{s.title}</text>
                <text x={cx + 21} y={cy + 30} style={{ fill: "var(--ink-2)", fontSize: 9 }}>{s.detail}</text>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
