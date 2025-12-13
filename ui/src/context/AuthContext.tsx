import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
	id: string;
	email?: string;
}

interface AuthContextType {
	user: User | null;
	loading: boolean;
	signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const checkAuth = () => {
			// Check for token in URL (callback from backend)
			const params = new URLSearchParams(window.location.search);
			const token = params.get('token');
			const userId = params.get('userId');
			const email = params.get('email');

			if (token && userId) {
				localStorage.setItem('auth_token', token);
				localStorage.setItem('user_id', userId);
				if (email) localStorage.setItem('user_email', email);

				setUser({ id: userId, email: email || undefined });
				// Clean URL
				window.history.replaceState(
					{},
					document.title,
					window.location.pathname
				);
			} else {
				// Check local storage
				const storedToken = localStorage.getItem('auth_token');
				const storedUserId = localStorage.getItem('user_id');
				const storedEmail = localStorage.getItem('user_email');

				if (storedToken && storedUserId) {
					setUser({ id: storedUserId, email: storedEmail || undefined });
				}
			}
			setLoading(false);
		};

		checkAuth();
	}, []);

	const signOut = () => {
		localStorage.removeItem('auth_token');
		localStorage.removeItem('user_id');
		localStorage.removeItem('user_email');
		setUser(null);
		window.location.href = '/auth';
	};

	const value = {
		user,
		loading,
		signOut,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
}
