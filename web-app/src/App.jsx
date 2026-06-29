import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookOpen, Shield, ClipboardList, Search, Layers } from 'lucide-react';

import Home from './pages/Home.jsx';
import OrderForm from './pages/OrderForm.jsx';
import CheckOrder from './pages/CheckOrder.jsx';
import OrderStatus from './pages/OrderStatus.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false
    }
  }
});

function Navigation() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <nav className="navbar">
      <Link to="/" className="nav-logo">
        <Layers className="text-primary" size={24} />
        <span className="gradient-title">KP</span>
      </Link>
      
      <div className="nav-links">
        {isAdmin ? (
          <>
            <Link to="/admin" className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}>
              Dashboard
            </Link>
            <Link to="/" className="nav-link">
              Storefront
            </Link>
          </>
        ) : (
          <>
            <Link to="/order" className={`nav-link ${location.pathname === '/order' ? 'active' : ''}`}>
              Buy Product
            </Link>
            <Link to="/check-order" className={`nav-link ${location.pathname === '/check-order' ? 'active' : ''}`}>
              Lookup Receipt
            </Link>
            <Link to="/admin/login" className="nav-link">
              <Shield size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Admin
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navigation />
          
          <main style={{ flexGrow: 1 }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/order" element={<OrderForm />} />
              <Route path="/check-order" element={<CheckOrder />} />
              <Route path="/order/:receiptCode" element={<OrderStatus />} />
              <Route path="/order/magic/:token" element={<OrderStatus />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </main>
          
          <footer style={{ 
            textAlign: 'center', 
            padding: '2rem', 
            color: 'var(--text-dim)', 
            fontSize: '0.85rem',
            borderTop: '1px solid var(--border-light)',
            background: 'var(--bg-darker)',
            fontFamily: 'var(--font-secondary)'
          }}>
            &copy; {new Date().getFullYear()} KP. All rights reserved. 
            <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.1)' }}>|</span> 
            Secure Digital Delivery Platform.
          </footer>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
