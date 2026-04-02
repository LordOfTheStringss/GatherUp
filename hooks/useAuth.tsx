import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseClient } from '../src/infra/SupabaseClient';
import { useAuthStore } from '../src/store/authStore';

const supabase = SupabaseClient.getInstance().client;

type AuthContextType = {
    session: Session | null | undefined;
    isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({ session: undefined, isLoading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    const checkBouncer = async (currentSession: Session | null) => {
        // If there's no session, we're already locked out
        if (!currentSession?.user) {
            setIsLoading(false);
            return;
        }

        // Maintain LOCKING state during the check to prevent flicker
        setIsLoading(true);

        try {
            const { data: userProfile, error } = await supabase
                .from('users')
                .select('status')
                .eq('id', currentSession.user.id)
                .single();

            if (error) {
                console.error('Error fetching user status in Bouncer:', error);
                setIsLoading(false);
                return;
            }

            if (userProfile?.status?.toLowerCase() === 'banned') {
                // Enforce STRICT hard lockout
                // 1. Sign out from Supabase
                await supabase.auth.signOut();
                
                // 2. Clear all local storage tokens
                await AsyncStorage.removeItem('@keep_me_signed_in');
                
                // 3. Explicitly reset useAuthStore state to null authenticated state
                useAuthStore.getState().logout();

                // 4. Reset our local session state
                setSession(null);

                // 5. Hard Redirect to Login
                router.replace('/(auth)/login');

                // 6. Notification to the user
                Alert.alert(
                    'Account Suspended',
                    'Your account has been restricted by an administrator.',
                    [{ text: 'OK' }]
                );
                
                // Maintain isLoading = true or similar to ensure the screen doesn't mount (tabs)
                // Actually, now that setSession is null, Root Layout Shield will handle it.
            } else {
                // User is clean
                setIsLoading(false);
            }
        } catch (err) {
            console.error('Bouncer check failed:', err);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Initial session fetch
        supabase.auth.getSession().then(({ data: { session: initialSession } }: any) => {
            setSession(initialSession);
            // If there's no session, we can unlock immediately
            if (!initialSession) {
                setIsLoading(false);
            } else {
                // Only unlock after bouncer check
                checkBouncer(initialSession);
            }
        });

        // Event listener for auth state transitions
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, currentSession: Session | null) => {
            setSession(currentSession);
            if (currentSession) {
                checkBouncer(currentSession);
            } else {
                setIsLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ session, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
