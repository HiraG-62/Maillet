import { useState, useEffect } from 'react';
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
  isDark,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
  accentColor?: string;
  isDark?: boolean;
}) => {
  if (active && payload && payload.length) {
    const entry = payload.find((p) => p.dataKey === 'total_amount');
    const bgColor = isDark ? '#1e293b' : '#ffffff';
    const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const labelColor = isDark ? '#94a3b8' : '#64748b';
    return (
      <div
        style={{
          backgroundColor: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: '8px',
          padding: '8px 12px',
        }}
      >
        <p style={{ color: labelColor, marginBottom: '4px', fontSize: '12px' }}>
          {label ? formatMonth(label) : ''}
        </p>
        {entry && (
          <p style={{ color: accentColor, fontWeight: 'bold', fontSize: '14px', margin: 0 }}>
            ¥{entry.value.toLocaleString('ja-JP')}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function MonthlyBarChart({ data, height = 200 }: MonthlyBarChartProps) {
  const { barShades, tooltipAccent } = useChartColors();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const axisTick = isDark ? '#94a3b8' : '#64748b';
  const gridStroke = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
  const axisLineStroke = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonth}
          tick={{ fill: axisTick, fontSize: 12 }}
          axisLine={{ stroke: axisLineStroke }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fill: axisTick, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          content={<CustomTooltip accentColor={tooltipAccent} isDark={isDark} />}
          cursor={{ fill: hexToRgba(tooltipAccent, 0.08) }}
        />
        <Bar dataKey="total_amount" radius={[6, 6, 0, 0]} isAnimationActive={true}>
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={barShades[index % barShades.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
