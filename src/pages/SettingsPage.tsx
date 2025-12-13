import React, { useEffect, useState } from 'react';
import {
	Save,
	CheckCircle,
	AlertTriangle,
	Youtube,
	Clock,
	Moon,
	Sun,
	Monitor,
	Palette,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '../components/ui/card';

const API_BASE = 'http://localhost:4000';

export default function SettingsPage() {
	const [schedule, setSchedule] = useState('');
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState('');
	const { theme, setTheme } = useTheme();

	useEffect(() => {
		fetch(`${API_BASE}/settings`)
			.then((res) => res.json())
			.then((data) => {
				setSchedule(data.schedule);
				setIsAuthenticated(data.isAuthenticated);
			});
	}, []);

	const saveSettings = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setMessage('');

		try {
			const res = await fetch(`${API_BASE}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ schedule }),
			});

			if (res.ok) {
				setMessage('Settings saved successfully!');
			} else {
				setMessage('Failed to save settings.');
			}
		} catch (err) {
			console.error(err);
			setMessage('Error saving settings.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className='space-y-6'>
			{/* Header */}
			<div>
				<h2 className='text-2xl font-bold text-gray-900 dark:text-white'>
					Settings
				</h2>
				<p className='text-gray-500 dark:text-gray-400 text-sm mt-1'>
					Configure your pipeline and preferences
				</p>
			</div>

			<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
				{/* YouTube Connection */}
				<Card>
					<CardHeader>
						<CardTitle className='flex items-center gap-2'>
							<Youtube className='text-red-500' size={20} />
							YouTube Connection
						</CardTitle>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div
							className={`p-4 rounded-xl border-2 ${
								isAuthenticated
									? 'border-green-500/20 bg-green-500/5'
									: 'border-red-500/20 bg-red-500/5'
							}`}
						>
							<div className='flex items-center gap-3 mb-2'>
								{isAuthenticated ? (
									<div className='w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center'>
										<CheckCircle className='text-green-500' size={20} />
									</div>
								) : (
									<div className='w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center'>
										<AlertTriangle className='text-red-500' size={20} />
									</div>
								)}
								<div>
									<p className='font-semibold text-gray-900 dark:text-white'>
										{isAuthenticated ? 'Connected' : 'Not Connected'}
									</p>
									<p className='text-sm text-gray-500 dark:text-gray-400'>
										{isAuthenticated
											? 'Your account is linked and ready'
											: 'Connect to enable uploads'}
									</p>
								</div>
							</div>
						</div>

						{!isAuthenticated && (
							<a href={`${API_BASE}/auth/youtube`} className='block'>
								<Button className='w-full bg-red-600 hover:bg-red-700 text-white gap-2 h-12'>
									<Youtube size={18} />
									Connect YouTube Account
								</Button>
							</a>
						)}
					</CardContent>
				</Card>

				{/* Theme Settings */}
				<Card>
					<CardHeader>
						<CardTitle className='flex items-center gap-2'>
							<Palette className='text-coral' size={20} />
							Appearance
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className='text-sm text-gray-500 dark:text-gray-400 mb-4'>
							Choose your preferred theme
						</p>
						<div className='grid grid-cols-3 gap-3'>
							<button
								onClick={() => setTheme('light')}
								className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
									theme === 'light'
										? 'border-coral bg-coral/5'
										: 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
								}`}
							>
								<div
									className={`w-10 h-10 rounded-full flex items-center justify-center ${
										theme === 'light'
											? 'bg-coral text-white'
											: 'bg-gray-100 dark:bg-dark-hover text-gray-500'
									}`}
								>
									<Sun size={20} />
								</div>
								<span className='text-sm font-medium text-gray-900 dark:text-white'>
									Light
								</span>
							</button>
							<button
								onClick={() => setTheme('dark')}
								className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
									theme === 'dark'
										? 'border-coral bg-coral/5'
										: 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
								}`}
							>
								<div
									className={`w-10 h-10 rounded-full flex items-center justify-center ${
										theme === 'dark'
											? 'bg-coral text-white'
											: 'bg-gray-100 dark:bg-dark-hover text-gray-500'
									}`}
								>
									<Moon size={20} />
								</div>
								<span className='text-sm font-medium text-gray-900 dark:text-white'>
									Dark
								</span>
							</button>
							<button
								onClick={() => {
									const prefersDark = window.matchMedia(
										'(prefers-color-scheme: dark)'
									).matches;
									setTheme(prefersDark ? 'dark' : 'light');
								}}
								className='flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600 transition-all'
							>
								<div className='w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-hover text-gray-500 flex items-center justify-center'>
									<Monitor size={20} />
								</div>
								<span className='text-sm font-medium text-gray-900 dark:text-white'>
									System
								</span>
							</button>
						</div>
					</CardContent>
				</Card>

				{/* Schedule Settings */}
				<Card className='lg:col-span-2'>
					<CardHeader>
						<CardTitle className='flex items-center gap-2'>
							<Clock className='text-coral' size={20} />
							Pipeline Schedule
						</CardTitle>
					</CardHeader>
					<CardContent>
						<form onSubmit={saveSettings} className='space-y-4'>
							<div>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
									Cron Schedule Expression
								</label>
								<div className='flex flex-col sm:flex-row gap-4'>
									<div className='flex-1'>
										<Input
											type='text'
											value={schedule}
											onChange={(e) => setSchedule(e.target.value)}
											placeholder='* * * * *'
											className='font-mono h-12'
										/>
									</div>
									<Button
										type='submit'
										disabled={saving}
										className='h-12 px-6 bg-coral hover:bg-coral-dark text-white gap-2'
									>
										<Save size={18} />
										{saving ? 'Saving...' : 'Save Schedule'}
									</Button>
								</div>
								<p className='text-xs text-gray-400 dark:text-gray-500 mt-2'>
									Standard cron syntax: minute hour day month weekday. Default{' '}
									<code className='bg-gray-100 dark:bg-dark-hover px-1 py-0.5 rounded'>
										* * * * *
									</code>{' '}
									runs every minute.
								</p>
							</div>

							{/* Quick Presets */}
							<div className='flex flex-wrap gap-2 pt-2'>
								<button
									type='button'
									onClick={() => setSchedule('* * * * *')}
									className='text-xs px-3 py-1.5 bg-cream-dark dark:bg-dark-hover text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-border transition-colors'
								>
									Every minute
								</button>
								<button
									type='button'
									onClick={() => setSchedule('*/5 * * * *')}
									className='text-xs px-3 py-1.5 bg-cream-dark dark:bg-dark-hover text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-border transition-colors'
								>
									Every 5 minutes
								</button>
								<button
									type='button'
									onClick={() => setSchedule('*/15 * * * *')}
									className='text-xs px-3 py-1.5 bg-cream-dark dark:bg-dark-hover text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-border transition-colors'
								>
									Every 15 minutes
								</button>
								<button
									type='button'
									onClick={() => setSchedule('0 * * * *')}
									className='text-xs px-3 py-1.5 bg-cream-dark dark:bg-dark-hover text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-border transition-colors'
								>
									Every hour
								</button>
								<button
									type='button'
									onClick={() => setSchedule('0 0 * * *')}
									className='text-xs px-3 py-1.5 bg-cream-dark dark:bg-dark-hover text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-border transition-colors'
								>
									Daily at midnight
								</button>
							</div>

							{message && (
								<div
									className={`p-4 rounded-xl flex items-center gap-3 ${
										message.includes('success')
											? 'bg-green-500/10 text-green-600'
											: 'bg-red-500/10 text-red-600'
									}`}
								>
									{message.includes('success') ? (
										<CheckCircle size={18} />
									) : (
										<AlertTriangle size={18} />
									)}
									{message}
								</div>
							)}
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
