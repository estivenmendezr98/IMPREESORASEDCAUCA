import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as auth from '../lib/auth';

// Definir tipos
interface User {
    id: string;
    email?: string;
    full_name?: string;
    role?: string;
    [key: string]: any;
}

interface Session {
    access_token: string;
    user: User;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
    signUp: (email: string, password: string, metadata?: auth.UserMetadata) => Promise<{ data: any; error: any }>;
    signOut: () => Promise<{ error: any }>;
    isAdmin: () => boolean;
    isReader: () => boolean;
    isReadOnly: () => boolean;
    canModify: () => boolean;
    isSuperAdmin: () => boolean;
    getUserFullName: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    // Inicializar sesión
    const initSession = async () => {
        try {
            const { data } = await auth.getSession();

            if (data && data.session) {
                setSession(data.session as Session);
                setUser(data.session.user);
            } else {
                setSession(null);
                setUser(null);
            }
        } catch (err) {
            console.error('Error initializing session:', err);
            setSession(null);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        initSession();

        // Listener para sincronizar pestañas
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'impresiones_app_auth') {
                initSession();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const signIn = async (email: string, password: string) => {
        setLoading(true);
        try {
            const result = await auth.signIn(email, password);

            if (result.data?.session) {
                const sessionToStore = {
                    ...result.data.session,
                    user: result.data.user
                };

                localStorage.setItem('impresiones_app_auth', JSON.stringify(sessionToStore));

                setSession(sessionToStore as Session);
                setUser(result.data.user);

                return { data: result.data, error: null };
            }

            return result;
        } catch (error) {
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const signUp = async (email: string, password: string, metadata?: auth.UserMetadata) => {
        setLoading(true);
        try {
            const result = await auth.signUp(email, password, metadata);
            return result;
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        setLoading(true);
        try {
            await auth.signOut();
            setSession(null);
            setUser(null);
            return { error: null };
        } catch (error) {
            throw error;
        } finally {
            setLoading(false);
        }
    };

    // Helper functions using the current user state
    const isAdmin = () => auth.isAdmin(user);
    const isReader = () => auth.isReader(user);
    const isReadOnly = () => auth.isReadOnly(user);
    const canModify = () => auth.canModify(user);
    const isSuperAdmin = () => auth.isSuperAdmin(user);
    const getUserFullName = () => auth.getUserFullName(user);

    const value = {
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        isAdmin,
        isReader,
        isReadOnly,
        canModify,
        isSuperAdmin,
        getUserFullName
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
