/**
 * Isometric operations landscape for the sign-in hero: a request travels from a preschool centre through approval,
 * purchasing, delivery and finance to the executive view. Pure SVG built from the design tokens, so it themes with the
 * app and costs no JavaScript; motion is CSS (entrances, parallax via --px/--py) plus three SMIL packets on the path.
 * Light comes from the top-left: +y faces take mix 86, +x faces mix 70, and every box gets a bottom ambient-occlusion
 * fade plus a hairline highlight on its lit edges (--hl, defined per theme in globals.css).
 */
type V3 = readonly [number, number, number];

const COS = Math.cos(Math.PI / 6);
const U = 24; // px per world unit
const P = (x: number, y: number, z = 0) => [(x - y) * COS * U, (x + y) * 0.5 * U - z * U] as const;
const pts = (a: V3[]) => a.map(([x, y, z]) => P(x, y, z).map((n) => n.toFixed(1)).join(",")).join(" ");
const seg = (a: V3, b: V3) => `M${P(...a).map((n) => n.toFixed(1)).join(" ")} L${P(...b).map((n) => n.toFixed(1)).join(" ")}`;
const SHADE = "#14233a"; // blue-black, so shadowed faces read cool rather than grey
const mix = (c: string, pct: number) => `color-mix(in oklab, ${c} ${pct}%, ${SHADE})`;
const tint = (c: string, pct: number) => `color-mix(in oklab, ${c} ${pct}%, var(--surface))`;
const HL = { stroke: "var(--hl)", strokeWidth: 0.8, fill: "none", strokeLinecap: "round" } as const;

interface BoxProps { x: number; y: number; z?: number; w: number; d: number; h: number; color: string; top?: string; edge?: boolean; floors?: number; cols?: number }

function Box({ x, y, z = 0, w, d, h, color, top, edge = false, floors, cols }: BoxProps) {
  const zt = z + h, xr = x + w, yf = y + d;
  const left = pts([[x, yf, z], [xr, yf, z], [xr, yf, zt], [x, yf, zt]]);
  const right = pts([[xr, y, z], [xr, yf, z], [xr, yf, zt], [xr, y, zt]]);
  const stroke = edge ? { stroke: "color-mix(in oklab, var(--line-strong) 80%, transparent)", strokeWidth: 0.6 } : {};
  // Facade: floor bands and mullions on both visible walls.
  const lines: string[] = [];
  if (floors) for (let zz = z + floors; zz < zt - 0.05; zz += floors) lines.push(seg([x, yf, zz], [xr, yf, zz]), seg([xr, y, zz], [xr, yf, zz]));
  if (cols) {
    for (let xx = x + cols; xx < xr - 0.05; xx += cols) lines.push(seg([xx, yf, z], [xx, yf, zt]));
    for (let yy = y + cols; yy < yf - 0.05; yy += cols) lines.push(seg([xr, yy, z], [xr, yy, zt]));
  }
  return (
    <g strokeLinejoin="round">
      <polygon points={left} style={{ fill: mix(color, 86), ...stroke }} />
      <polygon points={right} style={{ fill: mix(color, 70), ...stroke }} />
      {h > 0.3 && <><polygon points={left} fill="url(#face-ao)" /><polygon points={right} fill="url(#face-ao)" /></>}
      {lines.length > 0 && <path d={lines.join(" ")} style={{ stroke: "var(--hl)", strokeWidth: 0.5, opacity: 0.45 }} />}
      <polygon points={pts([[x, y, zt], [xr, y, zt], [xr, yf, zt], [x, yf, zt]])} style={{ fill: top ?? color, ...stroke }} />
      <path d={`${seg([x, yf, zt], [xr, yf, zt])} ${seg([xr, yf, zt], [xr, y, zt])} ${seg([xr, yf, z], [xr, yf, zt])}`} style={{ ...HL, opacity: h > 0.12 ? 1 : 0.6 }} />
    </g>
  );
}

/** Gable roof with its ridge along x; the gable end faces +x. `wall` colours the gable triangle. */
function Roof({ x, y, z, w, d, h, color, wall }: { x: number; y: number; z: number; w: number; d: number; h: number; color: string; wall: string }) {
  const o = 0.1, x0 = x - o, x1 = x + w + o, ym = y + d / 2, zr = z + h;
  return (
    <g strokeLinejoin="round">
      <polygon points={pts([[x0, y - o, z], [x1, y - o, z], [x1, ym, zr], [x0, ym, zr]])} style={{ fill: color }} />
      <polygon points={pts([[x + w, y, z], [x + w, y + d, z], [x + w, ym, zr]])} style={{ fill: mix(wall, 72) }} />
      <polygon points={pts([[x1, y - o, z], [x1, y + d + o, z], [x1, y + d + o, z - 0.07], [x1, y - o, z - 0.07]])} style={{ fill: mix(color, 60) }} />
      <polygon points={pts([[x0, y + d + o, z], [x1, y + d + o, z], [x1, ym, zr], [x0, ym, zr]])} style={{ fill: mix(color, 90) }} />
      <polygon points={pts([[x0, y + d + o, z - 0.07], [x1, y + d + o, z - 0.07], [x1, y + d + o, z], [x0, y + d + o, z]])} style={{ fill: mix(color, 72) }} />
      <path d={`${seg([x0, ym, zr], [x1, ym, zr])} ${seg([x1, ym, zr], [x1, y + d + o, z])}`} style={HL} />
    </g>
  );
}

/** Flat panel on a +y wall (plane y) or a +x wall (plane x): windows, doors, stripes. */
const PaneY = ({ y, x0, x1, z0, z1, fill, opacity }: { y: number; x0: number; x1: number; z0: number; z1: number; fill: string; opacity?: number }) => (
  <polygon points={pts([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]])} style={{ fill, opacity }} />
);
const PaneX = ({ x, y0, y1, z0, z1, fill, opacity }: { x: number; y0: number; y1: number; z0: number; z1: number; fill: string; opacity?: number }) => (
  <polygon points={pts([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]])} style={{ fill, opacity }} />
);
const glass = "color-mix(in oklab, var(--blue-soft) 75%, var(--blue))";

/** Wheel: a vertical circle in the x–z plane, projected exactly. */
function Wheel({ x, y, z, r }: { x: number; y: number; z: number; r: number }) {
  const ring = (rr: number) => pts(Array.from({ length: 16 }, (_, i) => [x + rr * Math.cos((i / 16) * Math.PI * 2), y, z + rr * Math.sin((i / 16) * Math.PI * 2)] as const));
  return <><polygon points={ring(r)} style={{ fill: mix("var(--ink-2)", 55) }} /><polygon points={ring(r * 0.45)} style={{ fill: "var(--line-strong)" }} /></>;
}

function Tree({ x, y, z, s = 1 }: { x: number; y: number; z: number; s?: number }) {
  const [cx, cy] = P(x, y, z + 0.55 * s);
  return (
    <g>
      <Box x={x - 0.05} y={y - 0.05} z={z} w={0.1} d={0.1} h={0.4 * s} color={mix("var(--amber)", 55)} />
      <circle cx={cx} cy={cy} r={8 * s} style={{ fill: mix("var(--green)", 88) }} />
      <circle cx={cx - 1.6 * s} cy={cy - 2 * s} r={5.4 * s} style={{ fill: tint("var(--green)", 78) }} />
    </g>
  );
}

/** Soft contact shadow, nudged down-right away from the top-left light. */
const Shadow = ({ x, y, w, d, z }: { x: number; y: number; w: number; d: number; z: number }) => (
  <polygon points={pts([[x, y, z], [x + w + 0.5, y, z], [x + w + 0.5, y + d + 0.5, z], [x, y + d + 0.5, z]])} style={{ fill: SHADE, opacity: 0.16, filter: "blur(3.5px)" }} />
);

/** Station pad: a thin inlaid tile in the station's tone, so each step owns a lot on the board. */
const Pad = ({ x, y, r, tone }: { x: number; y: number; r: number; tone: string }) => (
  <Box x={x - r} y={y - r} z={F} w={r * 2} d={r * 2} h={0.05} color={tint(tone, 26)} top={tint(tone, 16)} />
);

interface Station { key: string; title: string; detail: string; tone: string; top: number; pad: number; draw: (x: number, y: number) => React.ReactNode }

const F = 0.5; // board thickness; objects stand on z = F
const G = F + 0.05; // pad surface

/* Objects are drawn around their station centre (x, y). `top` is the object height in world units, for the card leader. */
const STATIONS: Station[] = [
  {
    key: "centre", title: "Baner centre", detail: "Voice request recorded", tone: "var(--orange)", top: 2.15, pad: 1.35,
    draw: (x, y) => <>
      <Shadow x={x - 1.05} y={y - 0.8} w={2.1} d={1.6} z={G} />
      <Box x={x - 1.12} y={y - 0.87} z={G} w={2.24} d={1.74} h={0.12} color="var(--surface)" edge />
      <Box x={x - 1.05} y={y - 0.8} z={G + 0.12} w={2.1} d={1.6} h={0.95} color={tint("var(--orange)", 6)} />
      {[-0.82, -0.2].map((o) => <g key={o}>
        <PaneY y={y + 0.8} x0={x + o} x1={x + o + 0.45} z0={G + 0.38} z1={G + 0.84} fill="var(--surface)" />
        <PaneY y={y + 0.8} x0={x + o + 0.04} x1={x + o + 0.41} z0={G + 0.42} z1={G + 0.8} fill={glass} />
        <path d={`${seg([x + o + 0.225, y + 0.8, G + 0.42], [x + o + 0.225, y + 0.8, G + 0.8])} ${seg([x + o + 0.04, y + 0.8, G + 0.61], [x + o + 0.41, y + 0.8, G + 0.61])}`} style={{ stroke: "var(--surface)", strokeWidth: 0.8 }} />
      </g>)}
      <PaneY y={y + 0.8} x0={x + 0.45} x1={x + 0.85} z0={G + 0.12} z1={G + 0.78} fill="var(--orange)" />
      <PaneX x={x + 1.05} y0={y - 0.5} y1={y + 0.5} z0={G + 0.38} z1={G + 0.8} fill={glass} opacity={0.85} />
      <Roof x={x - 1.05} y={y - 0.8} z={G + 1.07} w={2.1} d={1.6} h={0.62} color="var(--orange)" wall={tint("var(--orange)", 6)} />
      <Tree x={x + 1.2} y={y + 1.05} z={G} s={0.85} />
    </>,
  },
  {
    key: "request", title: "Monthly request", detail: "7 items · AI draft", tone: "var(--blue)", top: 0.95, pad: 1.05,
    draw: (x, y) => <>
      <Shadow x={x - 0.8} y={y - 0.65} w={1.6} d={1.3} z={G} />
      <Box x={x - 0.85} y={y - 0.7} z={G} w={1.7} d={1.4} h={0.1} color={tint("var(--blue)", 18)} />
      {[0, 1, 2].map((i) => <Box key={i} x={x - 0.68 + i * 0.07} y={y - 0.55 - i * 0.07} z={G + 0.1 + i * 0.14} w={1.25} d={1} h={0.1} color="var(--surface)" edge />)}
      <path d={[0.15, 0.32, 0.49, 0.66].map((o, i) => seg([x - 0.4, y - 0.69 + o, G + 0.52], [x + (i === 3 ? 0.05 : 0.4), y - 0.69 + o, G + 0.52])).join(" ")} style={{ stroke: "var(--line-strong)", strokeWidth: 1.2, strokeLinecap: "round" }} />
      <Box x={x - 0.22} y={y - 0.74} z={G + 0.52} w={0.45} d={0.12} h={0.08} color="var(--blue)" />
    </>,
  },
  {
    key: "approval", title: "Head Office", detail: "Approved · 1 edit", tone: "var(--blue)", top: 3.6, pad: 1.15,
    draw: (x, y) => <>
      <Shadow x={x - 0.95} y={y - 0.95} w={1.9} d={1.9} z={G} />
      <Box x={x - 0.95} y={y - 0.95} z={G} w={1.9} d={1.9} h={0.32} color="var(--surface)" edge />
      <PaneY y={y + 0.95} x0={x - 0.25} x1={x + 0.25} z0={G} z1={G + 0.26} fill={glass} />
      <Box x={x - 0.7} y={y - 0.7} z={G + 0.32} w={1.4} d={1.4} h={2.25} color="var(--blue)" floors={0.32} cols={0.47} />
      <Box x={x - 0.5} y={y - 0.5} z={G + 2.57} w={1} d={1} h={0.34} color={tint("var(--blue)", 72)} cols={0.25} />
      <Box x={x - 0.56} y={y - 0.56} z={G + 2.91} w={1.12} d={1.12} h={0.06} color="var(--surface)" />
      <path d={seg([x, y, G + 2.97], [x, y, G + 3.45])} style={{ stroke: "var(--ink-2)", strokeWidth: 1, strokeLinecap: "round" }} />
      <circle cx={P(x, y, G + 3.48)[0]} cy={P(x, y, G + 3.48)[1]} r="2.2" className="scene-beacon" style={{ fill: "var(--orange)" }} />
    </>,
  },
  {
    key: "purchasing", title: "Purchasing", detail: "5 POs issued", tone: "var(--amber)", top: 1.45, pad: 1.15,
    draw: (x, y) => <>
      <Shadow x={x - 1} y={y - 0.8} w={2} d={1.6} z={G} />
      <Box x={x - 1} y={y - 0.8} z={G} w={1.4} d={1.4} h={0.8} color={tint("var(--amber)", 20)} cols={0.2} />
      <PaneY y={y + 0.6} x0={x - 0.8} x1={x - 0.2} z0={G} z1={G + 0.55} fill={mix("var(--amber)", 80)} />
      <path d={[0.12, 0.24, 0.36, 0.48].map((zz) => seg([x - 0.8, y + 0.6, G + zz], [x - 0.2, y + 0.6, G + zz])).join(" ")} style={{ stroke: "var(--hl)", strokeWidth: 0.6 }} />
      <Roof x={x - 1} y={y - 0.8} z={G + 0.8} w={1.4} d={1.4} h={0.38} color="var(--amber)" wall={tint("var(--amber)", 20)} />
      <Box x={x + 0.55} y={y - 0.45} z={G} w={0.75} d={0.75} h={0.06} color={mix("var(--amber)", 55)} />
      <Box x={x + 0.58} y={y - 0.42} z={G + 0.06} w={0.34} d={0.34} h={0.32} color="var(--orange)" />
      <Box x={x + 0.94} y={y - 0.42} z={G + 0.06} w={0.34} d={0.34} h={0.32} color="var(--amber)" />
      <Box x={x + 0.58} y={y - 0.06} z={G + 0.06} w={0.34} d={0.34} h={0.32} color="var(--amber)" />
      <Box x={x + 0.94} y={y - 0.06} z={G + 0.06} w={0.34} d={0.34} h={0.32} color="var(--orange)" />
      <Box x={x + 0.76} y={y - 0.24} z={G + 0.38} w={0.34} d={0.34} h={0.3} color="var(--amber)" />
    </>,
  },
  {
    key: "delivery", title: "Deliveries", detail: "Received at Baner", tone: "var(--green)", top: 1.4, pad: 1.25,
    draw: (x, y) => <>
      <Shadow x={x - 1.2} y={y - 0.5} w={2.3} d={1} z={G} />
      <Box x={x - 1.15} y={y - 0.42} z={G + 0.14} w={2.2} d={0.84} h={0.1} color={mix("var(--surface)", 45)} />
      <Box x={x - 1.2} y={y - 0.5} z={G + 0.24} w={1.5} d={1} h={0.95} color="var(--surface)" edge />
      <PaneY y={y + 0.5} x0={x - 1.2} x1={x + 0.3} z0={G + 0.5} z1={G + 0.62} fill="var(--green)" />
      <PaneY y={y + 0.5} x0={x - 1.2} x1={x + 0.3} z0={G + 0.62} z1={G + 0.67} fill="var(--blue)" />
      <Box x={x + 0.34} y={y - 0.5} z={G + 0.24} w={0.68} d={1} h={0.5} color="var(--blue)" />
      <Box x={x + 0.34} y={y - 0.5} z={G + 0.74} w={0.44} d={1} h={0.3} color="var(--blue)" />
      <PaneX x={x + 0.78} y0={y - 0.42} y1={y + 0.42} z0={G + 0.78} z1={G + 1} fill={glass} />
      <PaneY y={y + 0.5} x0={x + 0.42} x1={x + 0.72} z0={G + 0.78} z1={G + 0.98} fill={glass} />
      <PaneX x={x + 1.02} y0={y + 0.22} y1={y + 0.4} z0={G + 0.42} z1={G + 0.54} fill="var(--amber)" />
      {[-0.85, -0.25, 0.7].map((wx) => <Wheel key={wx} x={x + wx} y={y + 0.5} z={G + 0.19} r={0.19} />)}
    </>,
  },
  {
    key: "finance", title: "Finance", detail: "3-way matched", tone: "var(--green)", top: 1.75, pad: 1.15,
    draw: (x, y) => <>
      <Shadow x={x - 1} y={y - 0.85} w={2} d={1.7} z={G} />
      <Box x={x - 1} y={y - 0.85} z={G} w={2} d={1.7} h={0.09} color="var(--surface)" edge />
      <Box x={x - 0.92} y={y - 0.77} z={G + 0.09} w={1.84} d={1.54} h={0.09} color="var(--surface)" edge />
      <Box x={x - 0.82} y={y - 0.65} z={G + 0.18} w={1.3} d={1.3} h={0.85} color={tint("var(--green)", 14)} />
      <PaneX x={x + 0.48} y0={y - 0.2} y1={y + 0.2} z0={G + 0.18} z1={G + 0.68} fill={mix("var(--green)", 75)} />
      {[-0.6, -0.24, 0.12, 0.48].map((o) => <Box key={o} x={x + 0.62} y={y + o} z={G + 0.18} w={0.12} d={0.12} h={0.85} color="var(--surface)" />)}
      <Box x={x - 0.82} y={y - 0.68} z={G + 1.03} w={1.62} d={1.36} h={0.15} color="var(--surface)" edge />
      <Roof x={x - 0.82} y={y - 0.68} z={G + 1.18} w={1.62} d={1.36} h={0.4} color="var(--green)" wall="var(--surface)" />
    </>,
  },
  {
    key: "executive", title: "Executive view", detail: "Spend vs budget", tone: "var(--violet)", top: 3.7, pad: 1.05,
    draw: (x, y) => <>
      <Shadow x={x - 0.6} y={y - 0.6} w={1.2} d={1.2} z={G} />
      <Box x={x - 0.6} y={y - 0.6} z={G} w={1.2} d={1.2} h={1.95} color="var(--violet)" floors={0.32} cols={0.4} />
      <Box x={x - 0.45} y={y - 0.45} z={G + 1.95} w={0.9} d={0.9} h={0.2} color={tint("var(--violet)", 70)} />
      <polygon points={pts([[x - 0.3, y - 0.3, G + 2.15], [x + 0.3, y + 0.3, G + 2.15], [x + 0.85, y + 0.85, G + 2.65], [x - 0.85, y - 0.85, G + 2.65]])} style={{ fill: "var(--violet)", opacity: 0.1 }} />
      <g className="scene-float">
        <Box x={x - 0.85} y={y - 0.85} z={G + 2.65} w={1.7} d={1.7} h={0.06} color="var(--surface)" edge />
        {([[0.25, 0.55, "var(--blue)"], [0.62, 0.95, "var(--violet)"], [0.99, 0.45, "var(--green)"], [1.36, 0.75, "var(--blue)"]] as const).map(([o, h, c]) => (
          <Box key={o} x={x - 0.85 + o} y={y - 0.12} z={G + 2.71} w={0.22} d={0.22} h={h} color={c} />
        ))}
      </g>
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
  const p = PLACED.map((s) => P(s.x, s.y, G + 0.02));
  let d = `M${p[0]![0].toFixed(1)} ${p[0]![1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!, p1 = p[i]!, p2 = p[i + 1]!, p3 = p[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]!.toFixed(1)} ${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)} ${c2[1]!.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

const CARD_W = 118, CARD_H = 40;

export function OpsScene() {
  const path = flowPath();
  // Board: a white operating surface on a tinted plinth, with an inset rim, a minor/major grid and corner registration marks.
  const fx0 = Math.min(...PLACED.map((s) => s.x)) - 1.4, fx1 = Math.max(...PLACED.map((s) => s.x)) + 1.4;
  const fy0 = Math.min(...PLACED.map((s) => s.y)) - 1.4, fy1 = Math.max(...PLACED.map((s) => s.y)) + 1.4;
  const ix0 = fx0 + 0.4, ix1 = fx1 - 0.4, iy0 = fy0 + 0.4, iy1 = fy1 - 0.4;
  const minor: string[] = [], major: string[] = [];
  for (let gx = Math.ceil(ix0), k = 0; gx < ix1; gx++, k++) (k % 3 === 0 ? major : minor).push(seg([gx, iy0, F], [gx, iy1, F]));
  for (let gy = Math.ceil(iy0), k = 0; gy < iy1; gy++, k++) (k % 3 === 0 ? major : minor).push(seg([ix0, gy, F], [ix1, gy, F]));
  const tick = 0.6;
  const marks = ([[ix0, iy0, 1, 1], [ix1, iy0, -1, 1], [ix1, iy1, -1, -1], [ix0, iy1, 1, -1]] as const)
    .map(([cx, cy, sx, sy]) => `${seg([cx + sx * tick, cy, F], [cx, cy, F])} ${seg([cx, cy, F], [cx, cy + sy * tick, F])}`).join(" ");
  const ordered = [...PLACED].sort((a, b) => a.x + a.y - (b.x + b.y));

  return (
    <svg viewBox="-330 -16 660 392" className="ops-scene h-full w-full" role="img" aria-label="A request moving from a Jumpstart centre through Head Office approval, purchasing, delivery and finance to the executive view">
      <defs>
        <linearGradient id="flow-grad" x1="0" x2="1">
          <stop offset="0" stopColor="var(--orange)" />
          <stop offset="0.45" stopColor="var(--blue)" />
          <stop offset="1" stopColor="var(--violet)" />
        </linearGradient>
        <linearGradient id="face-ao" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor={SHADE} stopOpacity="0" />
          <stop offset="1" stopColor={SHADE} stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id="board-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--surface)" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in oklab, var(--blue-soft) 55%, var(--surface))" }} />
        </linearGradient>
      </defs>

      <g className="scene-layer" style={{ "--depth": 0.35 } as React.CSSProperties}>
        <g className="scene-in" style={{ animationDelay: "60ms" }}>
          <polygon points={pts([[fx0 - 0.2, fy0 + 0.6, -1.1], [fx1 + 0.9, fy0 + 0.6, -1.1], [fx1 + 0.9, fy1 + 1.3, -1.1], [fx0 - 0.2, fy1 + 1.3, -1.1]])} style={{ fill: SHADE, opacity: 0.2, filter: "blur(18px)" }} />
          <Box x={fx0 - 0.3} y={fy0 - 0.3} z={-0.3} w={fx1 - fx0 + 0.6} d={fy1 - fy0 + 0.6} h={0.3} color={tint("var(--blue)", 30)} />
          <Box x={fx0} y={fy0} w={fx1 - fx0} d={fy1 - fy0} h={F} color="var(--surface)" top="url(#board-top)" edge />
          <polygon points={pts([[ix0, iy0, F], [ix1, iy0, F], [ix1, iy1, F], [ix0, iy1, F]])} style={{ fill: "color-mix(in oklab, var(--blue-soft) 22%, transparent)", stroke: "color-mix(in oklab, var(--blue) 22%, var(--line-strong))", strokeWidth: 0.8 }} />
          <path d={minor.join(" ")} style={{ stroke: "var(--line)", strokeWidth: 0.6 }} />
          <path d={major.join(" ")} style={{ stroke: "color-mix(in oklab, var(--blue) 14%, var(--line-strong))", strokeWidth: 0.75 }} />
          <path d={marks} style={{ stroke: "var(--blue)", strokeWidth: 1.4, strokeLinecap: "round", opacity: 0.55 }} />
        </g>
      </g>

      <g className="scene-layer" style={{ "--depth": 0.7 } as React.CSSProperties}>
        {PLACED.map((s, i) => <g key={s.key} className="scene-in" style={{ animationDelay: `${200 + i * 110}ms` }}><Pad x={s.x} y={s.y} r={s.pad} tone={s.tone} /></g>)}
        <path d={path} fill="none" style={{ stroke: "var(--blue)", strokeWidth: 10, opacity: 0.07, strokeLinecap: "round" }} className="scene-in" />
        <path d={path} fill="none" pathLength={1} stroke="url(#flow-grad)" strokeWidth="2" strokeLinecap="round" className="scene-path" />
        {ordered.map((s) => (
          <g key={s.key} className="scene-in scene-rise" style={{ animationDelay: `${260 + PLACED.indexOf(s) * 110}ms` }}>{s.draw(s.x, s.y)}</g>
        ))}
        {/* Requests in transit: a head-aligned comet (glow, body, bright core) travelling the flow line. Hidden under reduced motion. */}
        <g className="scene-flow" fill="none" strokeLinecap="round">
          {[0, 1].map((n) => (
            <g key={n} style={{ "--delay": `${2.1 + n * 3.5}s` } as React.CSSProperties}>
              <path d={path} pathLength={1} className="flow-comet" stroke="url(#flow-grad)" style={{ "--a": 0.13, strokeWidth: 9, filter: "blur(3px)", strokeOpacity: 0.45 } as React.CSSProperties} />
              <path d={path} pathLength={1} className="flow-comet" stroke="url(#flow-grad)" style={{ "--a": 0.075, strokeWidth: 3.2 } as React.CSSProperties} />
              <path d={path} pathLength={1} className="flow-comet" style={{ "--a": 0.022, stroke: "var(--surface)", strokeWidth: 1.6 } as React.CSSProperties} />
            </g>
          ))}
        </g>
        {/* Hover targets: one invisible prism per station (pad footprint up to the object top), front stations last. */}
        {ordered.map((s) => {
          const r = s.pad * 0.85, zt = G + s.top;
          return <polygon key={s.key} data-st={s.key} className="ops-hit" points={pts([[s.x - r, s.y - r, zt], [s.x + r, s.y - r, zt], [s.x + r, s.y - r, G], [s.x + r, s.y + r, G], [s.x - r, s.y + r, G], [s.x - r, s.y + r, zt]])} />;
        })}
      </g>

      {/* Cards stay hidden until their station is hovered; selectors come from the station keys. */}
      <style>{`${PLACED.map((s) => `.ops-scene:has([data-st="${s.key}"]:hover) [data-card="${s.key}"]`).join(",")}{opacity:1;transform:none}`}</style>
      <g className="scene-layer pointer-events-none" style={{ "--depth": 1.15 } as React.CSSProperties}>
        {PLACED.map((s, i) => {
          const [ax, ay] = P(s.x, s.y, G + s.top);
          const cx = ax - CARD_W / 2, cy = ay - CARD_H - 16;
          return (
            <g key={s.key} data-card={s.key} className="ops-label">
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
