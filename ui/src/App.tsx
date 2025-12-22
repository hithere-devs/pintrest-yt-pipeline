import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardHome from './pages/DashboardHome';
import QueuePage from './pages/QueuePage';
import HistoryPage from './pages/HistoryPage';
import VideoDetailPage from './pages/VideoDetailPage';
import SettingsPage from './pages/SettingsPage';
import CalendarPage from './pages/CalendarPage';
import ViralVideoGeneratorPage from './pages/ViralVideoGeneratorPage';
import CaptionTestPage from './pages/CaptionTestPage';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Loading spinner component
function LoadingScreen() {
	return (
		<div className='flex items-center justify-center h-screen bg-dark-bg'>
			<div className='flex flex-col items-center gap-4'>
				<div className='w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin' />
				<p className='text-gray-400'>Loading...</p>
			</div>
		</div>
	);
}

// Protected route - redirects to auth if not logged in
function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const { user, loading } = useAuth();

	if (loading) {
		return <LoadingScreen />;
	}

	if (!user) {
		return <Navigate to='/auth' replace />;
	}

	return children;
}

// Public route - redirects to dashboard if already logged in
function PublicRoute({
	children,
	redirectTo = '/dashboard',
}: {
	children: React.ReactNode;
	redirectTo?: string;
}) {
	const { user, loading } = useAuth();

	if (loading) {
		return <LoadingScreen />;
	}

	if (user) {
		return <Navigate to={redirectTo} replace />;
	}

	return children;
}

function App() {
	return (
		<ThemeProvider>
			<AuthProvider>
				<BrowserRouter>
					<Routes>
						{/* Public routes - redirect to dashboard if authenticated */}
						<Route
							path='/'
							element={
								<PublicRoute>
									<LandingPage />
								</PublicRoute>
							}
						/>
						<Route
							path='/auth'
							element={
								<PublicRoute>
									<AuthPage />
								</PublicRoute>
							}
						/>

						{/* Protected routes - require authentication */}
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
							<Route path='video/:videoId' element={<VideoDetailPage />} />
							<Route path='generate' element={<ViralVideoGeneratorPage />} />
							<Route path='test' element={<CaptionTestPage />} />
							<Route path='settings' element={<SettingsPage />} />
							<Route path='calendar' element={<CalendarPage />} />
						</Route>

						{/* Catch all - redirect to home */}
						<Route path='*' element={<Navigate to='/' replace />} />
					</Routes>
				</BrowserRouter>
			</AuthProvider>
		</ThemeProvider>
	);
}

export default App;
