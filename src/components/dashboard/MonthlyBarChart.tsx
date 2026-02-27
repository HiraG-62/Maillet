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
import { useChartColors, hexToRgba } from '@/hooks/useChartColors';

interface MonthlyDataPoint {
  month: string;
  total_amount: number;
  prev_total_amount?: number;
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
  accentColor,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
  accentColor?: string;
}) => {
  if (active && payload && payload.length) {
    const currentEntry = payload.find((p) => p.dataKey === 'total_amount');
    const prevEntry = payload.find((p) => p.dataKey === 'prev_total_amount');
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
        {currentEntry && (
          <p style={{ color: accentColor, fontWeight: 'bold', fontSize: '14px', margin: 0 }}>
            当月: ¥{currentEntry.value.toLocaleString('ja-JP')}
          </p>
        )}
        {prevEntry && prevEntry.value > 0 && (
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '2px 0 0' }}>
            前月: ¥{prevEntry.value.toLocaleString('ja-JP')}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function MonthlyBarChart({ data, height = 200 }: MonthlyBarChartProps) {
  const { barShades, tooltipAccent } = useChartColors();
  const hasPrevData = data.some((d) => (d.prev_total_amount ?? 0) > 0);

  return (
    <div>
      {hasPrevData && (
        <div className="flex items-center gap-4 mb-2 text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: barShades[barShades.length - 1] }}
            />
            <span>当月</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm opacity-30"
              style={{ backgroundColor: barShades[barShades.length - 1] }}
            />
            <span>前月</span>
          </div>
        </div>
      )}
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
          <Tooltip
            content={<CustomTooltip accentColor={tooltipAccent} />}
            cursor={{ fill: hexToRgba(tooltipAccent, 0.08) }}
          />
          {hasPrevData && (
            <Bar
              dataKey="prev_total_amount"
              radius={[4, 4, 0, 0]}
              fillOpacity={0.3}
              isAnimationActive={false}
              name="前月"
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-prev-${index}`}
                  fill={barShades[index % barShades.length]}
                />
              ))}
            </Bar>
          )}
          <Bar dataKey="total_amount" radius={[6, 6, 0, 0]} isAnimationActive={true} name="当月">
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={barShades[index % barShades.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
