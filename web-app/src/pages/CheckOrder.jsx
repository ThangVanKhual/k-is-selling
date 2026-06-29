import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, History, ArrowRight, AlertCircle } from 'lucide-react';

export default function CheckOrder() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [recentCodes, setRecentCodes] = useState([]);

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('order-storage');
    if (saved) {
      try {
        setRecentCodes(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent orders:', e);
      }
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    
    // Validate format XXXX-XXXX (8 chars plus hyphen, hyphen is optional we can format it)
    let formattedCode = cleanCode;
    if (cleanCode.length === 8 && !cleanCode.includes('-')) {
      formattedCode = `${cleanCode.slice(0, 4)}-${cleanCode.slice(4)}`;
    }

    if (!formattedCode || formattedCode.length < 8) {
      setError('Please enter a valid 8-character receipt code (e.g., ABCD-EFGH).');
      return;
    }

    setError('');
    navigate(`/order/${formattedCode}`);
  };

  const handleClearHistory = () => {
    localStorage.removeItem('order-storage');
    setRecentCodes([]);
  };

  return (
    <div className="container fade-in" style={{ maxWidth: '550px', marginTop: '3rem' }}>
      <div className="glass-card">
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }} className="gradient-title">Lookup Your Order</h2>
        <p style={{ marginBottom: '2rem' }}>
          Enter your 8-character receipt code to view your verification status and download your digital book files.
        </p>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            background: 'var(--danger-glow)',
            color: 'var(--danger)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Receipt Code (format: XXXX-XXXX)</label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="A1B2-C3D4" 
                value={code} 
                onChange={(e) => setCode(e.target.value)}
                maxLength={9}
                style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '0.05em' }}
                required
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.85rem 1.5rem' }}>
                <Search size={18} />
              </button>
            </div>
          </div>
        </form>

        {recentCodes.length > 0 && (
          <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                <History size={16} /> Recent Lookups
              </h4>
              <button 
                type="button" 
                onClick={handleClearHistory} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Clear
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentCodes.map((savedCode) => (
                <Link 
                  key={savedCode} 
                  to={`/order/${savedCode}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'var(--transition)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
                >
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>{savedCode}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    View Status <ArrowRight size={14} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
