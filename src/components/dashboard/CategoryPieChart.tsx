import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  Label,
  type LegendProps,
} from 'recharts';

interface CategoryDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface CategoryPieChartProps {
  data: CategoryDataPoint[];
  height?: number;
}

const PALETTE = [
  '#06b6d4', // cyan-500
  '#a855f7', // purple-500
  '#f97316', // orange-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#3b82f6', // blue-500
  '#ec4899', // pink-500
];

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '8px 12px',
        }}
      >
        <p style={{ color: '#94a3b8', marginBottom: '4px', fontSize: '12px' }}>
          {payload[0].name}
        </p>
        <p style={{ color: '#22d3ee', fontWeight: 'bold', fontSize: '14px' }}>
          ¥{payload[0].value.toLocaleString('ja-JP')}
        </p>
      </div>
    );
  }
  return null;
};

export default function CategoryPieChart({ data, height = 200 }: CategoryPieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const renderLegend = ({ payload }: LegendProps) => {
    if (!payload) return null;
    return (
      <ul
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 16px',
          justifyContent: 'center',
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {payload.map((entry, index) => {
          const item = data.find((d) => d.name === String(entry.value));
          return (
            <li key={index} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: entry.color ?? '#888',
                  flexShrink: 0,
                }}
              />
              <span style={{ color: '#e2e8f0', fontSize: '11px' }}>{String(entry.value)}</span>
              {item && (
                <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                  ¥{item.value.toLocaleString('ja-JP')}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          innerRadius={44}
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color ?? PALETTE[index % PALETTE.length]}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth={1}
            />
          ))}
          {data.length > 0 && (
            <Label
              position="center"
              content={({ viewBox }: { viewBox?: unknown }) => {
                const vb = viewBox as { cx?: number; cy?: number } | undefined;
                const cx = vb?.cx ?? 0;
                const cy = vb?.cy ?? 0;
                const totalStr =
                  total >= 10000
                    ? `¥${(total / 10000).toFixed(1)}万`
                    : `¥${total.toLocaleString()}`;
                return (
                  <text>
                    <tspan
                      x={cx}
                      y={cy - 8}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight="bold"
                      fill="#22d3ee"
                    >
                      {totalStr}
                    </tspan>
                    <tspan x={cx} y={cy + 8} textAnchor="middle" fontSize={10} fill="#94a3b8">
                      合計
                    </tspan>
                  </text>
                );
              }}
            />
          )}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Legend content={renderLegend as any} />
      </PieChart>
    </ResponsiveContainer>
  );
}
