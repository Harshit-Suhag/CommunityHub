import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('colonyhub_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('colonyhub_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
        localStorage.setItem('colonyhub_user', JSON.stringify(res.data.user));
      })
      .catch(() => {
        localStorage.removeItem('colonyhub_token');
        localStorage.removeItem('colonyhub_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((token, nextUser) => {
    localStorage.setItem('colonyhub_token', token);
    localStorage.setItem('colonyhub_user', JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const switchRole = useCallback(async (role) => {
    const res = await api.post('/auth/role', { role });
    login(res.data.token, res.data.user);
    return res.data.user;
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem('colonyhub_token');
    localStorage.removeItem('colonyhub_user');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, switchRole }),
    [user, loading, login, logout, switchRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
