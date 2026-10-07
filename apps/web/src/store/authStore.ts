import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: 'owner' | 'manager' | 'cashier';
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setToken: (token: string) => void;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      setToken: (token) => set({ accessToken: token }),
      setAuth: (token, user) => set({ accessToken: token, user }),
      logout: () => set({ accessToken: null, user: null }),
      isAuthenticated: () => !!get().accessToken && !!get().user,
    }),
    {
      name: 'hs-pharma-auth',
      partialize: (state) => ({ user: state.user }), // don't persist token
    }
  )
);
