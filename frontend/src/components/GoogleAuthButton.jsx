import { useEffect, useRef, useState } from 'react';
import api from '../api';

let googleScriptPromise;

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        googleScriptPromise = null;
        reject(new Error('Could not load Google sign-in'));
      };
      document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
}

export default function GoogleAuthButton({ intent, options, onSuccess, onError }) {
  const buttonRef = useRef(null);
  const latestRef = useRef({ options, onSuccess, onError });
  const [loadError, setLoadError] = useState('');
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  latestRef.current = { options, onSuccess, onError };

  useEffect(() => {
    if (!clientId || !buttonRef.current) return undefined;
    let active = true;

    loadGoogleIdentity()
      .then((google) => {
        if (!active || !buttonRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            try {
              const response = await api.post('/auth/google', {
                ...latestRef.current.options,
                credential,
                intent,
              });
              latestRef.current.onSuccess(response.data);
            } catch (err) {
              latestRef.current.onError(
                err.response?.data?.message || err.message || 'Google sign-in failed'
              );
            }
          },
        });
        google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: intent === 'register' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          width: 280,
        });
      })
      .catch((err) => {
        if (active) setLoadError(err.message);
      });

    return () => {
      active = false;
      if (buttonRef.current) buttonRef.current.replaceChildren();
    };
  }, [clientId, intent]);

  if (!clientId) {
    return <p className="muted google-config-hint">Google sign-in needs a Google OAuth client ID in the frontend environment.</p>;
  }

  return (
    <div className="google-auth">
      {loadError && <p className="alert">{loadError}</p>}
      <div ref={buttonRef} />
    </div>
  );
}
