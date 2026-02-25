import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
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
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
  '#10b981', // emerald-500
  '#eab308', // yellow-500
  '#ef4444', // red-500
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
          background: '#1a1a2e',
          border: '1px solid #2a2a3a',
          borderRadius: '6px',
          padding: '8px 12px',
        }}
      >
        <p style={{ color: '#94a3b8', marginBottom: '4px', fontSize: '12px' }}>
          {payload[0].name}
        </p>
        <p style={{ color: '#06b6d4', fontWeight: 'bold', fontSize: '14px' }}>
          ¥{payload[0].value.toLocaleString('ja-JP')}
        </p>
      </div>
    );
  }
  return null;
};

const renderLegend = ({ payload }: LegendProps) => {
  if (!payload) return null;
  return (
    <ul
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 12px',
        justifyContent: 'center',
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {payload.map((entry, index) => (
        <li key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
          <span style={{ color: '#94a3b8', fontSize: '11px' }}>{String(entry.value)}</span>
        </li>
      ))}
    </ul>
  );
};

export default function CategoryPieChart({ data, height = 200 }: CategoryPieChartProps) {
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
          innerRadius={40}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color ?? PALETTE[index % PALETTE.length]}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Legend content={renderLegend as any} />
      </PieChart>
    </ResponsiveContainer>
  );
}
