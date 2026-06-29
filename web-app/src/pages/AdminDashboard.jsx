import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, Settings as SettingsIcon, Users, Check, X, Trash2, Eye, ExternalLink, Filter, Search, FileText, Package, CheckSquare, Edit3 } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('orders'); // orders, settings
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Selected product to edit in settings tab
  const [selectedProductId, setSelectedProductId] = useState('kp_blueprint');

  // Settings & Product locator edit state
  const [bookPublished, setBookPublished] = useState(false);
  const [pdfLocator, setPdfLocator] = useState('');
  const [epubLocator, setEpubLocator] = useState('');
  const [pdfFilename, setPdfFilename] = useState('');
  const [epubFilename, setEpubFilename] = useState('');
  
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');

  const token = localStorage.getItem('admin-token');

  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
    }
  }, [token, navigate]);

  const adminFetch = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    const res = await adminFetchRaw(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('admin-token');
      navigate('/admin/login');
      throw new Error('Unauthorized');
    }
    return res;
  };

  const adminFetchRaw = async (url, options = {}) => {
    return fetch(url, options);
  };

  // Fetch Orders
  const { data: ordersData, isLoading: isOrdersLoading } = useQuery({
    queryKey: ['admin-orders', search, statusFilter],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        q: search,
        status: statusFilter
      });
      const res = await adminFetch(`/api/admin/orders?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch orders');
      return res.json();
    },
    enabled: !!token
  });

  // Fetch Settings (returns settings and products list)
  const { data: configData } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
    enabled: !!token
  });

  const productsList = configData?.products || [];
  const globalSettings = configData?.settings;

  // Initialize global settings state
  useEffect(() => {
    if (globalSettings) {
      setBookPublished(globalSettings.bookPublished);
    }
  }, [globalSettings]);

  // Populate dynamic product configuration fields when selected product changes
  useEffect(() => {
    if (productsList.length > 0) {
      const activeProd = productsList.find(p => p.id === selectedProductId);
      if (activeProd) {
        setPdfLocator(activeProd.pdfLocator || '');
        setEpubLocator(activeProd.epubLocator || '');
        setPdfFilename(activeProd.pdfFilename || 'asset.pdf');
        setEpubFilename(activeProd.epubFilename || 'asset.epub');
      }
    }
  }, [selectedProductId, configData]);

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, isRead }) => {
      const res = await adminFetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, isRead })
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      if (selectedOrder && selectedOrder.id === updatedOrder.id) {
        setSelectedOrder(updatedOrder);
      }
    }
  });

  // Delete Order Mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (id) => {
      const res = await adminFetch(`/api/admin/orders/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete order');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setSelectedOrder(null);
    }
  });

  // Update Settings Mutation (Global switch)
  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings) => {
      const res = await adminFetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      setSettingsSuccess('Global settings updated successfully!');
      setTimeout(() => setSettingsSuccess(''), 3000);
    }
  });

  // Update Product configuration Mutation
  const updateProductMutation = useMutation({
    mutationFn: async ({ id, updatedData }) => {
      const res = await adminFetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update product settings');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      setSettingsSuccess('Product catalog configuration saved successfully!');
      setSettingsError('');
      setTimeout(() => setSettingsSuccess(''), 3000);
    },
    onError: (err) => {
      setSettingsError(err.message);
      setSettingsSuccess('');
    }
  });

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('admin-token');
    navigate('/admin/login');
  };

  const handleOpenDetails = (order) => {
    setSelectedOrder(order);
    if (!order.isRead) {
      updateStatusMutation.mutate({ id: order.id, isRead: true });
    }
  };

  const handleSaveGlobalSettings = (checked) => {
    setBookPublished(checked);
    updateSettingsMutation.mutate({ bookPublished: checked });
  };

  const handleSaveProductSettings = (e) => {
    e.preventDefault();
    updateProductMutation.mutate({
      id: selectedProductId,
      updatedData: {
        pdfLocator,
        epubLocator,
        pdfFilename,
        epubFilename
      }
    });
  };

  return (
    <div className="container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem' }}>KP Admin Dashboard</h1>
          <p style={{ fontSize: '0.85rem' }}>Review uploads, verify payments, and manage catalog assets.</p>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => setActiveTab('orders')} 
          className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
        >
          <Users size={16} /> Submissions
        </button>
        <button 
          onClick={() => setActiveTab('settings')} 
          className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
        >
          <SettingsIcon size={16} /> Product Settings
        </button>
      </div>

      {activeTab === 'orders' ? (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
            <div style={{ flexGrow: 1, position: 'relative', minWidth: '250px' }}>
              <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input 
                type="text" 
                className="form-control" 
                style={{ paddingLeft: '2.5rem' }} 
                placeholder="Search by name, phone, or receipt code..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} style={{ color: 'var(--text-muted)' }} />
              <select 
                className="form-control" 
                style={{ width: '180px', padding: '0.8rem 1rem' }} 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {isOrdersLoading ? (
            <p>Loading submissions...</p>
          ) : ordersData?.orders.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p>No transactions matching your criteria were found.</p>
            </div>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Product</th>
                    <th>Buyer</th>
                    <th>Phone</th>
                    <th>Date</th>
                    <th>Downloads</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersData?.orders.map((order) => (
                    <tr key={order.id} style={{ opacity: order.isRead ? 0.85 : 1, fontWeight: order.isRead ? 'normal' : '600' }}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--primary)', letterSpacing: '0.05em' }}>
                        {!order.isRead && <span style={{ display: 'inline-block', width: '6px', height: '6px', background: 'var(--primary)', borderRadius: '50%', marginRight: '8px', verticalAlign: 'middle' }}></span>}
                        {order.receiptCode}
                      </td>
                      <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '4px',
                          color: 'var(--text-main)'
                        }}>
                          {order.product?.name ? order.product.name.split(' ')[0] : 'Unknown'}
                        </span>
                      </td>
                      <td>{order.name}</td>
                      <td>{order.phone}</td>
                      <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {order.downloadCountPdf} / {order.downloadCountEpub}
                        </span>
                      </td>
                      <td>
                        {order.status === 'pending' && <span className="badge badge-pending">Pending</span>}
                        {order.status === 'verified' && <span className="badge badge-verified">Verified</span>}
                        {order.status === 'rejected' && <span className="badge badge-rejected">Rejected</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          onClick={() => handleOpenDetails(order)} 
                          className="btn btn-secondary" 
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', gap: '0.25rem' }}
                        >
                          <Eye size={14} /> Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Settings Tab */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }} className="status-grid">
          
          {/* Products Sidebar selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Global Switches</h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Publish Downloads</span>
                <input 
                  type="checkbox" 
                  checked={bookPublished} 
                  onChange={(e) => handleSaveGlobalSettings(e.target.checked)} 
                  style={{ width: '36px', height: '18px', cursor: 'pointer' }}
                />
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h4 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.5rem' }}>Digital Catalog</h4>
              {productsList.map(prod => (
                <button
                  key={prod.id}
                  onClick={() => setSelectedProductId(prod.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    background: selectedProductId === prod.id ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.01)',
                    border: '1px solid',
                    borderColor: selectedProductId === prod.id ? 'var(--primary)' : 'var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    transition: 'var(--transition)'
                  }}
                >
                  <span>{prod.name.split(' ')[0]}</span>
                  {prod.pdfLocator && prod.epubLocator && <CheckSquare size={12} style={{ color: selectedProductId === prod.id ? 'white' : 'var(--success)' }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Configuration Form */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }} className="gradient-title">
              Configure Locator: {productsList.find(p => p.id === selectedProductId)?.name}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Locators represent asset filenames inside the private `api/books/` directory (e.g. `sample.pdf`).
            </p>

            {settingsSuccess && (
              <div style={{ padding: '1rem', background: 'var(--success-glow)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                {settingsSuccess}
              </div>
            )}

            {settingsError && (
              <div style={{ padding: '1rem', background: 'var(--danger-glow)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                {settingsError}
              </div>
            )}

            <form onSubmit={handleSaveProductSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Primary Format */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', background: 'rgba(255,255,255,0.01)' }}>
                <h4 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <FileText size={16} className="text-primary" /> Primary Format (PDF / Core package)
                </h4>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Locator Filename (under private books folder, e.g. sample.pdf)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="sample.pdf" 
                    value={pdfLocator}
                    onChange={(e) => setPdfLocator(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Download Filename (Provided to buyer on download)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="blueprint.pdf" 
                    value={pdfFilename}
                    onChange={(e) => setPdfFilename(e.target.value)}
                  />
                </div>
              </div>

              {/* Alternative Format */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', background: 'rgba(255,255,255,0.01)' }}>
                <h4 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <FileText size={16} className="text-secondary" /> Alternative Format (EPUB / Templates / Extras)
                </h4>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Locator Filename (under private books folder, e.g. sample.epub)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="sample.epub" 
                    value={epubLocator}
                    onChange={(e) => setEpubLocator(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Download Filename (Provided to buyer on download)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="blueprint_extras.epub" 
                    value={epubFilename}
                    onChange={(e) => setEpubFilename(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '0.8rem 1.5rem', alignSelf: 'flex-start', display: 'flex', gap: '0.4rem', fontSize: '0.9rem' }}>
                <Edit3 size={16} /> Save Product details
              </button>
            </form>
          </div>

        </div>
      )}

      {/* Details Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }} className="gradient-title">
              Review Submission
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }} className="modal-grid">
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>BUYER DETAILS</span>
                <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
                  <div><strong>Name:</strong> {selectedOrder.name}</div>
                  <div><strong>Phone:</strong> {selectedOrder.phone}</div>
                  <div><strong>Email:</strong> {selectedOrder.email || 'N/A'}</div>
                  <div><strong>Submitted:</strong> {new Date(selectedOrder.createdAt).toLocaleString()}</div>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>TRANSACTION INFO</span>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.9rem' }}>
                    <div><strong>Item:</strong> {selectedOrder.product?.name}</div>
                    <div><strong>Receipt Code:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{selectedOrder.receiptCode}</span></div>
                    <div><strong>Downloads:</strong> {selectedOrder.downloadCountPdf} / {selectedOrder.downloadCountEpub}</div>
                  </div>
                </div>

                {selectedOrder.note && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>BUYER NOTE</span>
                    <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', maxHeight: '100px', overflowY: 'auto' }}>
                      {selectedOrder.note}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>PAYMENT PROOF</span>
                {selectedOrder.paymentProofUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <a href={selectedOrder.paymentProofUrl} target="_blank" rel="noreferrer" style={{ display: 'block', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: '#000' }}>
                      <img 
                        src={selectedOrder.paymentProofUrl} 
                        alt="Payment Proof" 
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }} 
                      />
                    </a>
                    <a href={selectedOrder.paymentProofUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                      Open Original Image <ExternalLink size={12} />
                    </a>
                  </div>
                ) : (
                  <p style={{ color: 'var(--danger)' }}>No proof file URL.</p>
                )}
              </div>
            </div>

            {/* Verification Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => updateStatusMutation.mutate({ id: selectedOrder.id, status: 'verified' })}
                  className="btn btn-primary"
                  style={{ background: 'var(--success)', boxShadow: '0 4px 12px var(--success-glow)', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  disabled={selectedOrder.status === 'verified'}
                >
                  <Check size={16} /> Approve
                </button>
                <button 
                  onClick={() => updateStatusMutation.mutate({ id: selectedOrder.id, status: 'rejected' })}
                  className="btn btn-secondary"
                  style={{ border: '1px solid var(--danger)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  disabled={selectedOrder.status === 'rejected'}
                >
                  <X size={16} /> Reject
                </button>
              </div>

              <button 
                onClick={() => {
                  if (confirm('Are you sure you want to permanently delete this order and its payment proof image?')) {
                    deleteOrderMutation.mutate(selectedOrder.id);
                  }
                }}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
            
            <button className="modal-close" onClick={() => setSelectedOrder(null)}>
              <X size={20} />
            </button>
          </div>
        </div>
      )}
      
      <style>{`
        @media (max-width: 768px) {
          .status-grid {
            grid-template-columns: 1fr !important;
          }
          .modal-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
