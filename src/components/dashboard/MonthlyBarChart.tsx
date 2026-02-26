import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

interface MonthlyDataPoint {
  month: string;
  total_amount: number;
}

interface MonthlyBarChartProps {
  data: MonthlyDataPoint[];
  height?: number;
}

const formatMonth = (month: string) => {
  const parts = month.split('-');
  return parts[1] ? `${parseInt(parts[1])}月` : month;
};

const formatYAxis = (value: number) => {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(0)}万`;
  }
  return `${value}`;
};

// Gradient from muted → vivid teal: oldest month = darkest, most recent = brightest
const BAR_COLORS = [
  '#134e4a', // brand-900 (5 months ago)
  '#0f766e', // brand-700 (4 months ago)
  '#0d9488', // brand-600 (3 months ago)
  '#14b8a6', // brand-500 (2 months ago)
  '#2dd4bf', // brand-400 (1 month ago)
  '#5eead4', // brand-300 (current, vivid)
];

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
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
          {label ? formatMonth(label) : ''}
        </p>
        <p style={{ color: '#0d9488', fontWeight: 'bold', fontSize: '14px' }}>
          ¥{payload[0].value.toLocaleString('ja-JP')}
        </p>
      </div>
    );
  }
  return null;
};

export default function MonthlyBarChart({ data, height = 200 }: MonthlyBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonth}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(13, 148, 136, 0.08)' }} />
        <Bar dataKey="total_amount" radius={[6, 6, 0, 0]} isAnimationActive={true}>
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={BAR_COLORS[index % BAR_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
