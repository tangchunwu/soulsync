"use client";

interface DimensionScores {
  humor: number;
  depth: number;
  resonance: number;
  compatibility: number;
}

interface ScoreRadarChartProps {
  scores: DimensionScores;
  size?: number;
}

const LABELS = [
  { key: "humor", label: "幽默感", angle: -90 },
  { key: "depth", label: "深度", angle: 0 },
  { key: "resonance", label: "共鸣", angle: 90 },
  { key: "compatibility", label: "兼容性", angle: 180 },
];

export default function ScoreRadarChart({ scores, size = 200 }: ScoreRadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const rings = [0.25, 0.5, 0.75, 1.0];

  // 4 个维度对应 4 个方向（上右下左）
  const directions = [
    { dx: 0, dy: -1 },  // 上 - humor
    { dx: 1, dy: 0 },   // 右 - depth
    { dx: 0, dy: 1 },   // 下 - resonance
    { dx: -1, dy: 0 },  // 左 - compatibility
  ];

  const values = [scores.humor, scores.depth, scores.resonance, scores.compatibility];

  // 数据点坐标
  const points = values.map((v, i) => {
    const r = (v / 100) * maxR;
    return {
      x: cx + directions[i].dx * r,
      y: cy + directions[i].dy * r,
    };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {/* 背景同心菱形 */}
        {rings.map((scale) => {
          const r = maxR * scale;
          const d = directions.map((dir) => ({
            x: cx + dir.dx * r,
            y: cy + dir.dy * r,
          }));
          return (
            <polygon
              key={scale}
              points={d.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="rgba(148,163,184,0.2)"
              strokeWidth="1"
            />
          );
        })}

        {/* 轴线 */}
        {directions.map((dir, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + dir.dx * maxR}
            y2={cy + dir.dy * maxR}
            stroke="rgba(148,163,184,0.15)"
            strokeWidth="1"
          />
        ))}

        {/* 数据区域 */}
        <polygon
          points={polygon}
          fill="rgba(59,130,246,0.15)"
          stroke="rgba(59,130,246,0.6)"
          strokeWidth="2"
        />

        {/* 数据点 */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#3B82F6" stroke="white" strokeWidth="2" />
        ))}

        {/* 标签 */}
        {LABELS.map((label, i) => {
          const labelR = maxR + 18;
          const lx = cx + directions[i].dx * labelR;
          const ly = cy + directions[i].dy * labelR;
          return (
            <text
              key={label.key}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-[11px] font-medium"
              fill="#64748B"
            >
              {label.label}
            </text>
          );
        })}

        {/* 分数值 */}
        {values.map((v, i) => {
          const vr = maxR + 30;
          const vx = cx + directions[i].dx * vr;
          const vy = cy + directions[i].dy * vr + (directions[i].dy === 0 ? 12 : directions[i].dy * 6);
          return (
            <text
              key={`val-${i}`}
              x={vx}
              y={vy}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-[10px] font-bold"
              fill="#3B82F6"
            >
              {v}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
