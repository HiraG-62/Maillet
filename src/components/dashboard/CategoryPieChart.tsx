import { useState, useEffect, memo } from 'react';
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
import { useChartColors } from '@/hooks/useChartColors';
import { getCategoryColor } from '@/lib/category-colors';
import { formatCurrency } from '@/lib/utils';

interface CategoryDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface CategoryPieChartProps {
  data: CategoryDataPoint[];
  height?: number;
}

const CustomTooltip = ({
  active,
  payload,
  accentColor,
  isDark,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  accentColor?: string;
  isDark?: boolean;
}) => {
  if (active && payload && payload.length) {
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
          {payload[0].name}
        </p>
        <p style={{ color: accentColor, fontWeight: 'bold', fontSize: '14px' }}>
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

function CategoryPieChart({ data, height = 200 }: CategoryPieChartProps) {
  const { tooltipAccent } = useChartColors();
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const legendTextColor = isDark ? '#e2e8f0' : '#334155';
  const legendMutedColor = isDark ? '#94a3b8' : '#64748b';

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
              <span style={{ color: legendTextColor, fontSize: '11px' }}>{String(entry.value)}</span>
              {item && (
                <span style={{ color: legendMutedColor, fontSize: '11px' }}>
                  {formatCurrency(item.value)}
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
          data={sortedData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          innerRadius={44}
          paddingAngle={2}
          startAngle={90}
          endAngle={-270}
        >
          {sortedData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color ?? getCategoryColor(entry.name)}
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
                    : formatCurrency(total);
                return (
                  <text>
                    <tspan
                      x={cx}
                      y={cy - 8}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight="bold"
                      fill={tooltipAccent}
                    >
                      {totalStr}
                    </tspan>
                    <tspan x={cx} y={cy + 8} textAnchor="middle" fontSize={10} fill={isDark ? '#94a3b8' : '#64748b'}>
                      合計
                    </tspan>
                  </text>
                );
              }}
            />
          )}
        </Pie>
        <Tooltip content={<CustomTooltip accentColor={tooltipAccent} isDark={isDark} />} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Legend content={renderLegend as any} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default memo(CategoryPieChart);
