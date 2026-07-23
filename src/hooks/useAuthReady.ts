import { useAuth } from '../context/AuthContext';

/** True once auth bootstrap finished and the user has a valid session. */
export function useAuthReady() {
  const { isAuthenticated, isLoading } = useAuth();
  return {
    isAuthReady: !isLoading && isAuthenticated,
    isAuthenticated,
    isLoading,
  };
}
