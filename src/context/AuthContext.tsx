import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
} from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface User {
	id: string;
	email?: string;
}

interface AuthContextType {
	user: User | null;
	loading: boolean;
	isAuthenticated: boolean;
	signOut: () => void;
	verifyToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	// Verify token with backend
	const verifyToken = useCallback(async (): Promise<boolean> => {
		const token = localStorage.getItem('auth_token');
		if (!token) {
			return false;
		}

		try {
			const response = await fetch(`${API_URL}/auth/verify`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				// Token is invalid, clear storage
				localStorage.removeItem('auth_token');
				localStorage.removeItem('user_id');
				localStorage.removeItem('user_email');
				setUser(null);
				return false;
			}

			const data = await response.json();
			if (data.valid && data.user) {
				setUser({
					id: data.user.id,
					email: data.user.email,
				});
				// Update local storage with verified info
				localStorage.setItem('user_id', data.user.id);
				if (data.user.email) {
					localStorage.setItem('user_email', data.user.email);
				}
				return true;
			}
			return false;
		} catch (error) {
			console.error('Token verification failed:', error);
			return false;
		}
	}, []);

	useEffect(() => {
		const checkAuth = async () => {
			// Check for token in URL (callback from backend OAuth)
			const params = new URLSearchParams(window.location.search);
			const token = params.get('token');
			const userId = params.get('userId');
			const email = params.get('email');

			if (token && userId) {
				// Store tokens from OAuth callback
				localStorage.setItem('auth_token', token);
				localStorage.setItem('user_id', userId);
				if (email) localStorage.setItem('user_email', email);

				// Clean URL
				window.history.replaceState(
					{},
					document.title,
					window.location.pathname
				);

				// Verify the token with backend
				const isValid = await verifyToken();
				if (!isValid) {
					// Token from URL was invalid
					localStorage.removeItem('auth_token');
					localStorage.removeItem('user_id');
					localStorage.removeItem('user_email');
				}
			} else {
				// Check existing stored token
				const storedToken = localStorage.getItem('auth_token');
				if (storedToken) {
					await verifyToken();
				}
			}
			setLoading(false);
		};

		checkAuth();
	}, [verifyToken]);

	const signOut = useCallback(() => {
		localStorage.removeItem('auth_token');
		localStorage.removeItem('user_id');
		localStorage.removeItem('user_email');
		setUser(null);
		// Redirect to landing page
		window.location.href = '/';
	}, []);

	const value = {
		user,
		loading,
		isAuthenticated: !!user,
		signOut,
		verifyToken,
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
