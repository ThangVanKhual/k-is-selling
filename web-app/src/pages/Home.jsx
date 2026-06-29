import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Search, FileText, CheckCircle, Download, Layers, Eye, X, ArrowRight, Star } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState(null);

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/orders/stats/count');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    }
  });

  const { data: systemStatus } = useQuery({
    queryKey: ['system-status'],
    queryFn: async () => {
      const res = await fetch('/api/settings/book-status');
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    }
  });

  // Enrich metadata for the 4 catalog products (with swapped images)
  const productInfoMap = {
    openai: {
      image: '/openai.png',
      rating: '4.9',
      reviews: '124',
      badge: 'Bestseller',
      features: [
        'Build and deploy production-ready GPT-4 assistants',
        'Master prompt engineering and temperature control',
        'Learn fine-tuning pipelines with custom datasets',
        'Integrate DALL-E 3 image generation & Vision APIs',

      ]
    },
    capcut: {
      image: '/capcut.jpg',
      rating: '4.8',
      reviews: '89',
      badge: 'Trending',
      features: [
        'Master the timeline and advanced multi-track editing',
        'Cinematic color grading and custom LUT applications',
        'Pro animations using keyframes and curve editors',
        'Audio sync, sound design, and subtitle auto-captioning',
        'Ready-to-use transitions and export configurations'
      ]
    },
    gemini: {
      image: '/gemini.png',
      rating: '4.9',
      reviews: '72',
      badge: 'Popular',
      features: [
        'Harness multi-modal reasoning (Text + Vision + Audio)',
        'Design conversational flows using chat context caches',
        'Enforce structured JSON output formats programmatically',
        'Integrate Gemini Pro & Flash models for maximum speed',
        'Build agentic tools with function calling API'
      ]
    },
    canva: {
      image: '/canva.png',
      rating: '4.7',
      reviews: '143',
      badge: 'Popular',
      features: [
        'Establish coherent branding kits and style grids',
        'Design high-converting presentation slide decks',
        'Master grid alignments and typographic hierarchies',
        'Build custom reusable mockups and social media templates',
        'Collaborative editing workflows for design teams'
      ]
    }
  };

  const catalogProducts = systemStatus?.products?.filter(p => p.id !== 'kp_blueprint') || [];

  return (
    <div className="container fade-in">
      {/* Hero Section (Rebranded, centered, image removed) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        margin: '4rem 0 5rem 0',
        gap: '1.5rem'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 1rem',
          borderRadius: 'var(--radius-full)',
          background: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          fontSize: '0.85rem',
          color: 'var(--primary)',
          fontWeight: '600'
        }}>
          <Layers size={14} /> KP DIGITAL STOREFRONT
        </div>
        
        <h1 style={{ fontSize: '4rem', lineHeight: '1.1', fontWeight: 800, maxWidth: '800px' }}>
          <span className="gradient-title">KP is Selling</span>
        </h1>
        
        <p style={{ fontSize: '1.5rem', color: 'var(--text-main)', fontWeight: 500, letterSpacing: '0.01em' }}>
           Premium digital tools for everyone  
        </p>

        {stats && stats.count > 0 && (
          <div style={{ 
            fontSize: '0.95rem', 
            color: 'var(--success)', 
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '0.5rem'
          }}>
            <CheckCircle size={16} /> Over {stats.count} digital products delivered!
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <Link to="/check-order" className="btn btn-primary" style={{ padding: '0.9rem 2.2rem' }}>
            <Search size={18} /> Lookup Your Order
          </Link>
        </div>
      </div>

      {/* Products Grid Section */}
      <div style={{ marginTop: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
            Premium <span className="gradient-title">Digital Products & Assets</span>
          </h2>
          <p style={{ maxWidth: '650px', margin: '0 auto', fontSize: '1rem' }}>
            Enhance your developer and creator capabilities with these premium digital kits, design assets, and toolkits.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '2rem'
        }}>
          {catalogProducts.map((product) => {
            const info = productInfoMap[product.id] || { image: '/book_cover.png', rating: '4.8', reviews: '10' };
            return (
              <div key={product.id} className="glass-card" style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '1.5rem',
                gap: '1rem',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {info.badge && (
                  <span style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: product.id === 'openai' ? '#8b5cf6' : product.id === 'gemini' ? '#3b82f6' : '#ec4899',
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {info.badge}
                  </span>
                )}

                <div
                  onClick={() => navigate(`/order?product=${product.id}`)}
                  style={{
                    height: '180px',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    background: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer'
                  }}
                >
                  <img 
                    src={info.image} 
                    alt={product.name} 
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'var(--transition)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexGrow: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: '#fbbf24' }}>
                    <Star size={14} fill="#fbbf24" />
                    <span>{info.rating}</span>
                    <span style={{ color: 'var(--text-dim)' }}>({info.reviews} reviews)</span>
                  </div>
                  
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)' }}>{product.name}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {product.description}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)' }}>RM {product.price.toFixed(2)}</span>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => setSelectedProduct({ ...product, ...info })}
                      className="btn btn-secondary" 
                      style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', display: 'inline-flex', gap: '0.25rem' }}
                    >
                      <Eye size={14} /> Details
                    </button>
                    <button 
                      onClick={() => navigate(`/order?product=${product.id}`)}
                      className="btn btn-primary" 
                      style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem' }}
                    >
                      Buy
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How it works grid */}
      <div style={{ marginTop: '6rem', marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '3rem' }}>
          How the <span className="gradient-title">Order Process</span> Works
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem'
        }}>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              width: 'fit-content'
            }}>
              <ShoppingCart size={24} className="text-primary" />
            </div>
            <h3>1. Submit Order</h3>
            <p>Make a payment for your chosen digital product, fill in details, and upload your payment proof image.</p>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              width: 'fit-content'
            }}>
              <FileText size={24} className="text-secondary" />
            </div>
            <h3>2. Get Access Code</h3>
            <p>You will receive a unique 8-character receipt code and a magic token link immediately to bookmark and track status.</p>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              width: 'fit-content'
            }}>
              <Download size={24} className="text-success" />
            </div>
            <h3>3. Download Assets</h3>
            <p>Once admin validates your payment proof, downloads for PDF, EPUB, or asset zip files become instantly active on your receipt page.</p>
          </div>
        </div>
      </div>

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', marginTop: '0.5rem' }} className="modal-grid">
              <div style={{
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 'fit-content'
              }}>
                <img 
                  src={selectedProduct.image} 
                  alt={selectedProduct.name} 
                  style={{ width: '100%', height: 'auto', display: 'block' }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }} className="gradient-title">{selectedProduct.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: '#fbbf24' }}>
                    <Star size={14} fill="#fbbf24" />
                    <span>{selectedProduct.rating}</span>
                    <span style={{ color: 'var(--text-dim)' }}>({selectedProduct.reviews} reviews)</span>
                  </div>
                </div>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{selectedProduct.description}</p>
                
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>WHAT'S INCLUDED:</span>
                  <ul style={{ paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {selectedProduct.features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: '800' }}>RM {selectedProduct.price.toFixed(2)}</span>
                  <button 
                    onClick={() => {
                      setSelectedProduct(null);
                      navigate(`/order?product=${selectedProduct.id}`);
                    }}
                    className="btn btn-primary"
                  >
                    Buy Asset <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            <button className="modal-close" onClick={() => setSelectedProduct(null)}>
              <X size={20} />
            </button>
          </div>
        </div>
      )}
      
      <style>{`
        @media (max-width: 768px) {
          .modal-grid {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}
