import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileDown, Calendar, User, Phone, Mail, AlertTriangle, CheckCircle2, Clock, XCircle, Info, Copy, Layers } from 'lucide-react';

export default function OrderStatus() {
  const { receiptCode, token } = useParams();
  const location = useLocation();
  const [copiedLink, setCopiedLink] = useState(false);

  const isMagic = location.pathname.includes('/magic/');
  const lookupKey = isMagic ? token : receiptCode;

  // Fetch Order
  const { data: order, isLoading: isOrderLoading, error: orderError } = useQuery({
    queryKey: ['order', lookupKey],
    queryFn: async () => {
      const url = isMagic ? `/api/orders/magic/${lookupKey}` : `/api/orders/${lookupKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to load order');
      }
      return res.json();
    }
  });

  // Fetch System Settings
  const { data: systemStatus } = useQuery({
    queryKey: ['system-status'],
    queryFn: async () => {
      const res = await fetch('/api/settings/book-status');
      if (!res.ok) throw new Error('Failed to load system settings');
      return res.json();
    }
  });

  const handleCopyLink = () => {
    if (!order) return;
    const magicUrl = `${window.location.origin}/order/magic/${order.magicToken}`;
    navigator.clipboard.writeText(magicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (isOrderLoading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <p>Loading order details...</p>
      </div>
    );
  }

  if (orderError || !order) {
    return (
      <div className="container fade-in" style={{ maxWidth: '500px', marginTop: '4rem' }}>
        <div className="glass-card" style={{ textAlign: 'center', borderColor: 'var(--danger)' }}>
          <AlertTriangle size={48} style={{ color: 'var(--danger)', margin: '0 auto 1.5rem auto' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Order Not Found</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            We couldn't find any order matching the provided details. Please verify your receipt code and try again.
          </p>
          <Link to="/check-order" className="btn btn-primary">
            Back to Lookup
          </Link>
        </div>
      </div>
    );
  }

  const isVerified = order.status === 'verified';
  const isRejected = order.status === 'rejected';
  const isPending = order.status === 'pending';

  const canDownload = isVerified && systemStatus?.bookPublished;

  const hasPdf = !!order.product?.pdfLocator;
  const hasEpub = !!order.product?.epubLocator;

  return (
    <div className="container fade-in" style={{ maxWidth: '800px', marginTop: '2rem' }}>
      
      {/* Top Banner Status */}
      <div className="glass-card" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1.5rem', 
        marginBottom: '2rem',
        background: isVerified 
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(18, 18, 24, 0.75) 100%)' 
          : isRejected 
          ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.04) 0%, rgba(18, 18, 24, 0.75) 100%)' 
          : 'var(--bg-card)',
        borderColor: isVerified 
          ? 'rgba(16, 185, 129, 0.2)' 
          : isRejected 
          ? 'rgba(239, 68, 68, 0.2)' 
          : 'var(--border-light)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>RECEIPT FOR: {order.product?.name?.toUpperCase()}</span>
            <h2 style={{ fontSize: '2rem', fontFamily: 'monospace', color: 'var(--primary)', marginTop: '0.2rem' }}>{order.receiptCode}</h2>
          </div>
          
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', textAlign: 'right' }}>VERIFICATION STATUS</span>
            <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
              {isPending && (
                <span className="badge badge-pending">
                  <Clock size={12} /> Pending Review
                </span>
              )}
              {isVerified && (
                <span className="badge badge-verified">
                  <CheckCircle2 size={12} /> Verified & Approved
                </span>
              )}
              {isRejected && (
                <span className="badge badge-rejected">
                  <XCircle size={12} /> Payment Rejected
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.1rem' }} />
          <div style={{ fontSize: '0.9rem' }}>
            {isPending && (
              <p>Your payment proof is currently under review by our administrator. Once verified, asset downloads for <strong>{order.product?.name}</strong> will become available below.</p>
            )}
            {isVerified && (
              <p style={{ color: 'var(--success)' }}>Your payment has been successfully verified! You can now download the configured formats/assets below.</p>
            )}
            {isRejected && (
              <p style={{ color: 'var(--danger)' }}>Unfortunately, your payment verification was rejected. Please submit a new order with valid proof.</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }} className="status-grid">
        {/* Book Downloads */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.4rem' }} className="gradient-title">Available Downloads</h3>
          
          {!systemStatus?.bookPublished && isVerified && (
            <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--warning)' }}>
              The administrator has approved your payment, but the downloads are not officially published yet. Please check back later.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Primary Format */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '1rem', 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)'
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>Primary Format</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PDF / Main Asset package</div>
              </div>
              {canDownload && hasPdf ? (
                <a 
                  href={isMagic ? `/api/orders/magic/${lookupKey}/download/pdf` : `/api/orders/${lookupKey}/download/pdf`}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  <FileDown size={16} /> Download
                </a>
              ) : (
                <button className="btn btn-secondary" disabled style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  {!hasPdf ? 'Not Available' : 'Locked'}
                </button>
              )}
            </div>

            {/* Alternative Format */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '1rem', 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)'
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>Alternative Format</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>EPUB / Supporting templates</div>
              </div>
              {canDownload && hasEpub ? (
                <a 
                  href={isMagic ? `/api/orders/magic/${lookupKey}/download/epub` : `/api/orders/${lookupKey}/download/epub`}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  <FileDown size={16} /> Download
                </a>
              ) : (
                <button className="btn btn-secondary" disabled style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  {!hasEpub ? 'Not Available' : 'Locked'}
                </button>
              )}
            </div>
          </div>
          
          {isVerified && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center' }}>
              Downloads are cryptographically signed. Reshares can be traced back to this receipt.
            </div>
          )}
        </div>

        {/* Order details & magic link */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Details */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>Product Details</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem', fontFamily: 'var(--font-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={16} className="text-dim" style={{ color: 'var(--primary)' }} />
                <span><strong>Item:</strong> {order.product?.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={16} className="text-dim" style={{ color: 'var(--primary)' }} />
                <span>{order.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Phone size={16} className="text-dim" style={{ color: 'var(--primary)' }} />
                <span>{order.phone}</span>
              </div>
              {order.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={16} className="text-dim" style={{ color: 'var(--primary)' }} />
                  <span>{order.email}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} className="text-dim" style={{ color: 'var(--primary)' }} />
                <span>{new Date(order.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Magic link reminder */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem' }}>Magic Access Link</h3>
            <p style={{ fontSize: '0.85rem' }}>
              Use this direct link to visit this page without typing your receipt code. Do not share it.
            </p>
            <div className="copy-box">
              <span className="copy-text" style={{ fontSize: '0.8rem' }}>
                {`${window.location.origin}/order/magic/${order.magicToken.slice(0, 10)}...`}
              </span>
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={handleCopyLink}>
                {copiedLink ? 'Copied!' : <Copy size={14} />}
              </button>
            </div>
          </div>

        </div>
      </div>
      
      <style>{`
        @media (max-width: 768px) {
          .status-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
