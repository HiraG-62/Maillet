import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
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
          background: '#1a1a2e',
          border: '1px solid #2a2a3a',
          borderRadius: '6px',
          padding: '8px 12px',
        }}
      >
        <p style={{ color: '#94a3b8', marginBottom: '4px', fontSize: '12px' }}>
          {label ? formatMonth(label) : ''}
        </p>
        <p style={{ color: '#06b6d4', fontWeight: 'bold', fontSize: '14px' }}>
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
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonth}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={{ stroke: '#2a2a3a' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(6, 182, 212, 0.08)' }} />
        <Bar dataKey="total_amount" fill="#06b6d4" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
