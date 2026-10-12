import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api, getSession, saveSession } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession()?.user || null);

  const establish = useCallback((payload) => {
    saveSession(payload);
    setUser(payload.user);
    return payload.user;
  }, []);

  const login = useCallback(async (email, password) => establish(await api.post('/auth/login', { email, password })), [establish]);

  const register = useCallback(
    async (name, email, password) => establish(await api.post('/auth/register', { name, email, password })),
    [establish]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      saveSession(null);
    }
    saveSession(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, register, logout }), [user, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export const isStaff = (user) => ['ANALYST', 'OFFICER', 'ADMIN'].includes(user?.role);
export const isOfficer = (user) => ['OFFICER', 'ADMIN'].includes(user?.role);
