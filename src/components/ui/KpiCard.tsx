interface KpiCardProps {
  label: string;
  value: string;
  detail: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

export function KpiCard({ label, value, detail, tone = 'default' }: KpiCardProps) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      <p className="kpi-detail">{detail}</p>
    </article>
  );
}

