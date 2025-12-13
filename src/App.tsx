import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardHome from './pages/DashboardHome';
import QueuePage from './pages/QueuePage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const { user, loading } = useAuth();

	if (loading) {
		return (
			<div className='flex items-center justify-center h-screen bg-dark-bg'>
				<div className='flex flex-col items-center gap-4'>
					<div className='w-12 h-12 border-4 border-coral border-t-transparent rounded-full animate-spin' />
					<p className='text-gray-400'>Loading...</p>
				</div>
			</div>
		);
	}

	if (!user) {
		return <Navigate to='/auth' replace />;
	}

	return children;
}

function App() {
	return (
		<ThemeProvider>
			<AuthProvider>
				<BrowserRouter>
					<Routes>
						<Route path='/' element={<LandingPage />} />
						<Route path='/auth' element={<AuthPage />} />
						<Route
							path='/dashboard'
							element={
								<ProtectedRoute>
									<Layout />
								</ProtectedRoute>
							}
						>
							<Route index element={<DashboardHome />} />
							<Route path='queue' element={<QueuePage />} />
							<Route path='history' element={<HistoryPage />} />
							<Route path='settings' element={<SettingsPage />} />
						</Route>
					</Routes>
				</BrowserRouter>
			</AuthProvider>
		</ThemeProvider>
	);
}

export default App;
