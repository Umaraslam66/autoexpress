import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ChartConfig {
  type: 'bar' | 'pie' | 'line';
  title: string;
  data: { name: string; value: number; value2?: number }[];
  xLabel?: string;
  yLabel?: string;
}

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa', '#fb923c', '#34d399'];

const tooltipStyle = {
  contentStyle: { background: '#1e2130', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', fontSize: '13px' },
  labelStyle: { color: '#fff' },
  itemStyle: { color: '#a5b4fc' },
};

export function ChartRenderer({ config }: { config: ChartConfig }) {
  const hasSecondSeries = config.data.some((d) => d.value2 !== undefined);

  return (
    <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '16px' }}>
      <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, opacity: 0.9 }}>{config.title}</p>

      <ResponsiveContainer width="100%" height={240}>
        {config.type === 'pie' ? (
          <PieChart>
            <Pie data={config.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
              {config.data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
          </PieChart>
        ) : config.type === 'line' ? (
          <LineChart data={config.data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.4)', fontSize: 11 } : undefined} />
            <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} label={config.yLabel ? { value: config.yLabel, angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.4)', fontSize: 11 } : undefined} />
            <Tooltip {...tooltipStyle} />
            {hasSecondSeries && <Legend wrapperStyle={{ fontSize: '12px' }} />}
            <Line type="monotone" dataKey="value" name={config.yLabel ?? 'Value'} stroke={COLORS[0]} strokeWidth={2} dot={{ fill: COLORS[0], r: 3 }} />
            {hasSecondSeries && <Line type="monotone" dataKey="value2" name="Value 2" stroke={COLORS[1]} strokeWidth={2} dot={{ fill: COLORS[1], r: 3 }} />}
          </LineChart>
        ) : (
          <BarChart data={config.data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.4)', fontSize: 11 } : undefined} />
            <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} label={config.yLabel ? { value: config.yLabel, angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.4)', fontSize: 11 } : undefined} />
            <Tooltip {...tooltipStyle} />
            {hasSecondSeries && <Legend wrapperStyle={{ fontSize: '12px' }} />}
            <Bar dataKey="value" name={config.yLabel ?? 'Value'} radius={[4, 4, 0, 0]}>
              {config.data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
            {hasSecondSeries && <Bar dataKey="value2" name="Value 2" fill={COLORS[1]} radius={[4, 4, 0, 0]} />}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
