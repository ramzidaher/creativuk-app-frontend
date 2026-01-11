import { useAuth } from '../context/AuthContext';

export interface AdminPermissions {
  canManageUsers: boolean;
  canManageGHL: boolean;
  canAccessAnalytics: boolean;
  canViewSystemLogs: boolean;
  canManageSettings: boolean;
  canViewWinLoss: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canResetPasswords: boolean;
  canSuspendUsers: boolean;
  canActivateUsers: boolean;
  isAdmin: boolean;
}

export const useAdminPermissions = (): AdminPermissions => {
  const { user } = useAuth();
  
  const isAdmin = user?.role === 'ADMIN';
  
  return {
    canManageUsers: isAdmin,
    canManageGHL: isAdmin,
    canAccessAnalytics: isAdmin,
    canViewSystemLogs: isAdmin,
    canManageSettings: isAdmin,
    canViewWinLoss: isAdmin,
    canCreateUsers: isAdmin,
    canEditUsers: isAdmin,
    canDeleteUsers: isAdmin,
    canResetPasswords: isAdmin,
    canSuspendUsers: isAdmin,
    canActivateUsers: isAdmin,
    isAdmin,
  };
};

export default useAdminPermissions;


