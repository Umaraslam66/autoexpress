import { Link } from 'react-router-dom';

interface KpiCardProps {
  label: string;
  value: string;
  detail: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  to?: string;
}

function KpiCardBody({ label, value, detail }: Pick<KpiCardProps, 'label' | 'value' | 'detail'>) {
  return (
    <>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      <p className="kpi-detail">{detail}</p>
    </>
  );
}

export function KpiCard({ label, value, detail, tone = 'default', to }: KpiCardProps) {
  if (to) {
    return (
      <Link className={`kpi-card kpi-card-link kpi-${tone}`} to={to}>
        <KpiCardBody label={label} value={value} detail={detail} />
      </Link>
    );
  }

  return (
    <article className={`kpi-card kpi-${tone}`}>
      <KpiCardBody label={label} value={value} detail={detail} />
    </article>
  );
}
