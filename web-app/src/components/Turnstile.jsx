import React, { useEffect, useRef, useState } from 'react';

export default function Turnstile({ onVerify, resetRef }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

  useEffect(() => {
    // If site key is not configured, bypass
    if (!siteKey) {
      console.warn('VITE_TURNSTILE_SITE_KEY is not defined. CAPTCHA is in mock/development mode.');
      return;
    }

    const checkInterval = setInterval(() => {
      if (window.turnstile) {
        setIsLoaded(true);
        clearInterval(checkInterval);
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey || !isLoaded || !containerRef.current) return;

    // Clear container before rendering (to prevent multiple widgets)
    containerRef.current.innerHTML = '';

    try {
      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => {
          onVerify(token);
        },
        'expired-callback': () => {
          onVerify('');
        },
        'error-callback': () => {
          onVerify('');
        }
      });
      widgetIdRef.current = widgetId;
    } catch (e) {
      console.error('Turnstile render error:', e);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // ignore
        }
      }
    };
  }, [siteKey, isLoaded, onVerify]);

  // Hook up reset ref so parent can trigger resetting of CAPTCHA widget
  useEffect(() => {
    if (resetRef) {
      resetRef.current = () => {
        if (!siteKey) {
          onVerify('');
          return;
        }
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch (e) {
            console.error('Failed to reset Turnstile:', e);
          }
        }
      };
    }
  }, [siteKey, resetRef, onVerify]);

  if (!siteKey) {
    return (
      <div 
        style={{
          padding: '1rem',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px dashed rgba(59, 130, 246, 0.4)',
          borderRadius: '8px',
          textAlign: 'center',
          cursor: 'pointer'
        }}
        onClick={() => {
          console.log('Mock CAPTCHA verified!');
          onVerify('mock-turnstile-token');
        }}
      >
        <p style={{ color: '#60a5fa', fontSize: '0.85rem', fontWeight: '500' }}>
          🛡️ CAPTCHA Development Bypass (Click to verify)
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
      <div ref={containerRef}></div>
    </div>
  );
}
