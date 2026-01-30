import { apiClient } from './api';

export interface UserMetadata {
  full_name?: string;
  role?: 'superadmin' | 'admin' | 'user' | 'reader';
  office?: string;
  department?: string;
}

export const signIn = async (email: string, password: string) => {
  try {
    const response = await apiClient.login(email, password);

    if (response) {
      return {
        data: {
          user: response.user,
          session: response.session
        },
        error: null
      };
    }
    return { data: { user: null, session: null }, error: new Error('Login failed') };
  } catch (error: any) {
    return {
      data: { user: null, session: null },
      error: error
    };
  }
};

export const signUp = async (email: string, password: string, metadata: UserMetadata = {}) => {
  try {
    const userData = {
      email,
      password,
      full_name: metadata.full_name,
      role: metadata.role || 'user', // Default to user if not specified
      office: metadata.office,
      department: metadata.department,
      status: 'Normal'
    };

    const response = await apiClient.createUser(userData);

    if (response.success) {
      return { data: { user: response.user }, error: null };
    }
    return { data: { user: null }, error: new Error('Registration failed') };
  } catch (error: any) {
    return { data: { user: null }, error: error };
  }
};

export const signOut = async () => {
  try {
    localStorage.removeItem('impresiones_app_auth');
    return { error: null };
  } catch (error) {
    return { error };
  }
};

export const getCurrentUser = async () => {
  try {
    const stored = localStorage.getItem('impresiones_app_auth');
    if (stored) {
      const session = JSON.parse(stored);
      if (session && session.user) {
        return { data: { user: session.user }, error: null };
      }
    }
    return { data: { user: null }, error: null };
  } catch (e) {
    return { data: { user: null }, error: e };
  }
};

export const getSession = async () => {
  try {
    const stored = localStorage.getItem('impresiones_app_auth');
    if (stored) {
      const session = JSON.parse(stored);
      return { data: { session }, error: null };
    }
    return { data: { session: null }, error: null };
  } catch (e) {
    return { data: { session: null }, error: e };
  }
};

// Helper function to check if user is super admin
export const isSuperAdmin = (user: any) => {
  return user?.role === 'superadmin';
};

// Helper function to check if user is admin
export const isAdmin = (user: any) => {
  return user?.role === 'admin' || isSuperAdmin(user);
};

// Helper function to check if user is reader
export const isReader = (user: any) => {
  return user?.role === 'reader';
};

// Helper function to check if user has read-only access
export const isReadOnly = (user: any) => {
  return isReader(user);
};

// Helper function to check if user can modify data
export const canModify = (user: any) => {
  return isAdmin(user) || isSuperAdmin(user);
};

// Helper function to get user's full name
export const getUserFullName = (user: any) => {
  return user?.full_name || user?.email || 'Usuario';
};