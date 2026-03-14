import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAppState } from '../context/AppState';

export function LoginPage() {
  const { activeUser, login } = useAppState();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (activeUser) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const success = await login(email, password);
    setIsSubmitting(false);

    if (!success) {
      setError('Invalid credentials or backend session setup failed.');
      return;
    }

    navigate('/');
  }

  return (
    <div className="login-page">
      <div className="login-panel hero-panel">
        <p className="eyebrow">AutoXpress Internal Tool</p>
        <h1>Market-aware pricing in one operating cockpit.</h1>
        <p>
          Review live comparables, validate target retail prices, and generate export-ready pricing files without
          leaving the platform.
        </p>
        <div className="hero-metrics">
          <div>
            <strong>400+</strong>
            <span>Active stock units monitored</span>
          </div>
          <div>
            <strong>2x daily</strong>
            <span>Market data refresh cadence</span>
          </div>
          <div>
            <strong>Audit-ready</strong>
            <span>Full decision and override history</span>
          </div>
        </div>
      </div>

      <div className="login-panel form-panel">
        <div>
          <p className="eyebrow">Secure access</p>
          <h2>Sign in</h2>
          <p>Sign in to your AutoXpress account.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Enter platform'}
          </button>
        </form>

      </div>
    </div>
  );
}
