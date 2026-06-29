import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Upload, AlertCircle, Loader2, CheckCircle, Copy, ExternalLink, Package, Download, Home } from 'lucide-react';
import Turnstile from '../components/Turnstile.jsx';

export default function OrderForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialProductId = searchParams.get('product') || 'kp_blueprint';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [productId, setProductId] = useState(initialProductId);
  const [honeypot, setHoneypot] = useState('');
  
  const [paymentProof, setPaymentProof] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fileInputRef = useRef(null);
  const turnstileResetRef = useRef(null);

  // Fetch product catalog to populate selection dropdown
  const { data: systemStatus } = useQuery({
    queryKey: ['system-status'],
    queryFn: async () => {
      const res = await fetch('/api/settings/book-status');
      if (!res.ok) throw new Error('Failed to fetch system status');
      return res.json();
    }
  });

  const productsList = systemStatus?.products || [];

  // Update selection if query param changes
  useEffect(() => {
    const pId = searchParams.get('product');
    if (pId) {
      setProductId(pId);
    }
  }, [searchParams]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG, PNG, GIF, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File is too large. Payment proof must be under 5MB.');
      return;
    }

    setError('');
    setPaymentProof(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = (token) => {
    const magicUrl = `${window.location.origin}/order/magic/${token}`;
    navigator.clipboard.writeText(magicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone number are required.');
      return;
    }

    if (!paymentProof) {
      setError('Please upload your payment proof image.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('email', email);
    formData.append('note', note);
    formData.append('productId', productId);
    formData.append('contact_time', honeypot); // Honeypot field
    formData.append('paymentProof', paymentProof);
    
    if (turnstileToken) {
      formData.append('cf-turnstile-response', turnstileToken);
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong during order submission.');
      }

      setSuccessData(data);
      
      // Save code in localStorage
      const existing = JSON.parse(localStorage.getItem('order-storage') || '[]');
      const updated = [data.receiptCode, ...existing.filter(c => c !== data.receiptCode)].slice(0, 10);
      localStorage.setItem('order-storage', JSON.stringify(updated));

    } catch (err) {
      setError(err.message);
      if (turnstileResetRef.current) {
        turnstileResetRef.current();
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedProductObj = productsList.find(p => p.id === productId);

  if (successData) {
    const magicLink = `/order/magic/${successData.magicToken}`;
    return (
      <div className="container fade-in" style={{ maxWidth: '600px', marginTop: '2rem' }}>
        <div className="glass-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              background: 'var(--success-glow)',
              color: 'var(--success)',
              borderRadius: 'var(--radius-full)',
              padding: '1.25rem',
              width: 'fit-content'
            }}>
              <CheckCircle size={36} />
            </div>
          </div>

          <h2 style={{ fontSize: '2rem' }} className="gradient-title">Order Received!</h2>
          <p>
            Your payment proof for <strong>{selectedProductObj?.name || 'Digital Asset'}</strong> has been uploaded. An administrator will review your submission shortly.
          </p>

          <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>RECEIPT CODE</span>
              <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Keep this code to lookup your status manually.
              </p>
              <div className="copy-box">
                <span className="copy-text">{successData.receiptCode}</span>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={() => handleCopyCode(successData.receiptCode)}>
                  {copiedCode ? 'Copied!' : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>OPAQUE MAGIC LINK</span>
              <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Bookmark this URL. It bypasses code typing and leads directly to your downloads.
              </p>
              <div className="copy-box">
                <span className="copy-text" style={{ fontSize: '0.85rem' }}>
                  {`${window.location.origin}/order/magic/${successData.magicToken.slice(0, 12)}...`}
                </span>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={() => handleCopyLink(successData.magicToken)}>
                  {copiedLink ? 'Copied!' : <Copy size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn btn-primary" style={{ flexGrow: 1 }} onClick={() => navigate(magicLink)}>
              Go to Order Page <ExternalLink size={16} />
            </button>
            <button className="btn btn-secondary" onClick={() => setSuccessData(null)}>
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container fade-in" style={{ maxWidth: '650px', marginTop: '1rem' }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => navigate('/')}
        style={{ marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <Home size={16} /> Back to Home
      </button>

      <div className="glass-card">
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }} className="gradient-title">Order Form</h2>
        <p style={{ marginBottom: '2rem' }}>
          Select your digital product and fill in your transfer receipt details below.
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
          
          {/* Honeypot field */}
          <input 
            type="text" 
            name="contact_time" 
            value={honeypot} 
            onChange={(e) => setHoneypot(e.target.value)} 
            style={{ display: 'none' }} 
            autoComplete="off" 
            tabIndex="-1" 
          />

          {/* Payment QR & Phone */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.5rem',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center'
          }}>
            <img
              src="/qr.png"
              alt="Payment QR Code"
              style={{ maxWidth: '200px', width: '100%', borderRadius: 'var(--radius-md)' }}
            />
            <a
              href="/qr.png"
              download="payment-qr.png"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
            >
              <Download size={16} /> Download QR Code
            </a>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>MY PHONE NUMBER</span>
              <div className="copy-box" style={{ marginTop: '0.5rem' }}>
                <span className="copy-text" style={{ fontSize: '1.1rem', fontWeight: 600 }}>+600182580549</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.8rem' }}
                  onClick={() => {
                    navigator.clipboard.writeText('+600182580549');
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                >
                  {copiedCode ? 'Copied!' : <Copy size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Product Selector Dropdown */}
          <div className="form-group">
            <label className="form-label">Selected Digital Product *</label>
            <div style={{ position: 'relative' }}>
              <Package size={16} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <select 
                className="form-control" 
                style={{ paddingLeft: '2.8rem' }}
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
              >
                {productsList.map(prod => (
                  <option key={prod.id} value={prod.id}>
                    {prod.name} (RM {prod.price.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="John Doe" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number *</label>
            <input 
              type="tel" 
              className="form-control" 
              placeholder="+60 12-345 6789" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address (Optional)</label>
            <input 
              type="email" 
              className="form-control" 
              placeholder="john@example.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Additional Notes / Remarks (Optional)</label>
            <textarea 
              className="form-control" 
              rows="3" 
              placeholder="Any payment references or additional details..." 
              value={note} 
              onChange={(e) => setNote(e.target.value)}
            ></textarea>
          </div>

          {/* Payment Proof File Upload */}
          <div className="form-group">
            <label className="form-label">Upload Transfer Receipt * (JPG, PNG, WEBP. Max 5MB)</label>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange} 
              accept="image/*"
            />
            
            {previewUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                <img 
                  src={previewUrl} 
                  alt="Receipt Preview" 
                  style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px', alignSelf: 'center' }} 
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{paymentProof?.name}</span>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => {
                    setPaymentProof(null);
                    setPreviewUrl('');
                  }}>
                    Remove Image
                  </button>
                </div>
              </div>
            ) : (
              <div 
                className="upload-dropzone" 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    fileInputRef.current.files = e.dataTransfer.files;
                    handleFileChange({ target: { files: e.dataTransfer.files } });
                  }
                }}
              >
                <Upload size={32} className="text-dim" style={{ color: 'var(--primary)' }} />
                <div>
                  <p style={{ color: 'var(--text-main)', fontWeight: 500 }}>Click to browse files</p>
                  <p style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>or drag and drop your image receipt here</p>
                </div>
              </div>
            )}
          </div>

          <Turnstile onVerify={setTurnstileToken} resetRef={turnstileResetRef} />

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '1rem', marginTop: '1rem' }} 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Submitting Order...
              </>
            ) : (
              'Submit Payment Proof & Place Order'
            )}
          </button>

        </form>
      </div>
      
      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
