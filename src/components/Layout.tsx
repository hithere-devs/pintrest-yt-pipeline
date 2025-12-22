import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
	LayoutDashboard,
	ListVideo,
	History,
	Settings,
	Sparkles,
	Bell,
	Search,
	LogOut,
	Moon,
	Sun,
	Menu,
	X,
	ChevronDown,
	HelpCircle,
	Calendar,
	Wand2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from './ui/dropdown-menu';
import logoLight from '../assets/logo-light-trans.png';
import logoDark from '../assets/logo-dark-trans.png';

const navItems = [
	{ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
	{ icon: ListVideo, label: 'Queue', path: '/dashboard/queue' },
	{ icon: History, label: 'History', path: '/dashboard/history' },
	{ icon: Wand2, label: 'Generate', path: '/dashboard/generate' },
	{ icon: Calendar, label: 'Schedule', path: '/dashboard/calendar' },
	{ icon: Settings, label: 'Settings', path: '/dashboard/settings' },
];

export default function Layout() {
	const { user, signOut } = useAuth();
	const { theme, toggleTheme } = useTheme();
	const navigate = useNavigate();
	const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

	const today = new Date();
	const dayOfMonth = today.getDate();
	const dayName = today.toLocaleDateString('en-US', { weekday: 'short' });
	const monthName = today.toLocaleDateString('en-US', { month: 'long' });

	return (
		<div className='flex h-screen bg-cream dark:bg-dark-bg transition-colors duration-300'>
			{/* Sidebar - Desktop */}
			<aside className='hidden lg:flex w-64 flex-col p-4 border-r border-gray-100 dark:border-dark-border'>
				{/* Logo */}
				<div className='flex items-center gap-3 px-2 mb-6'>
					<img
						src={theme === 'dark' ? logoLight : logoDark}
						alt='Clipmil Logo'
						className='h-7 w-auto'
					/>
				</div>

				{/* Navigation */}
				<nav className='flex-1 space-y-1'>
					{navItems.map((item) => (
						<NavLink
							key={item.path}
							to={item.path}
							className={({ isActive }) =>
								`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 font-medium text-sm ${
									isActive
										? 'bg-coral text-white shadow-md shadow-coral/20'
										: 'text-gray-500 hover:bg-cream-dark dark:text-gray-400 dark:hover:bg-dark-hover'
								}`
							}
						>
							<item.icon size={18} />
							{item.label}
						</NavLink>
					))}
				</nav>

				{/* User Profile Section */}
				<div className='mt-auto pt-4 border-t border-gray-100 dark:border-dark-border'>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button className='flex items-center gap-3 w-full text-left hover:bg-cream-dark dark:hover:bg-dark-hover p-2 rounded-xl transition-colors'>
								<Avatar className='h-8 w-8 border border-coral/20'>
									<AvatarImage
										src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
									/>
									<AvatarFallback className='bg-coral/10 text-coral font-bold text-xs'>
										{user?.email?.substring(0, 2).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<div className='flex-1 overflow-hidden'>
									<p className='text-sm font-medium text-gray-900 dark:text-white truncate'>
										{user?.email?.split('@')[0]}
									</p>
									<p className='text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
										Creator
									</p>
								</div>
								<ChevronDown size={14} className='text-gray-400' />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end' className='w-56'>
							<DropdownMenuLabel>My Account</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem>Profile</DropdownMenuItem>
							<DropdownMenuItem>Billing</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => signOut()}
								className='text-red-500 focus:text-red-500'
							>
								<LogOut className='mr-2 h-4 w-4' />
								Sign Out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</aside>

			{/* Mobile Sidebar Overlay */}
			{isMobileSidebarOpen && (
				<div className='lg:hidden fixed inset-0 z-50'>
					<div
						className='absolute inset-0 bg-black/50 backdrop-blur-sm'
						onClick={() => setIsMobileSidebarOpen(false)}
					/>
					<aside className='absolute left-0 top-0 h-full w-72 bg-cream dark:bg-dark-bg p-6 flex flex-col shadow-2xl'>
						<div className='flex items-center justify-between mb-8'>
							<div className='flex items-center gap-3'>
								<div className='w-10 h-10 bg-coral rounded-xl flex items-center justify-center'>
									<Sparkles
										size={20}
										className='text-white'
										fill='currentColor'
									/>
								</div>
								<h1 className='text-xl font-bold text-gray-900 dark:text-white'>
									Clipmil
								</h1>
							</div>
							<Button
								variant='ghost'
								size='icon'
								onClick={() => setIsMobileSidebarOpen(false)}
							>
								<X size={20} />
							</Button>
						</div>

						<nav className='flex-1 space-y-1'>
							{navItems.map((item) => (
								<NavLink
									key={item.path}
									to={item.path}
									onClick={() => setIsMobileSidebarOpen(false)}
									className={({ isActive }) =>
										`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 font-medium ${
											isActive
												? 'bg-coral text-white shadow-lg shadow-coral/20'
												: 'text-gray-500 hover:bg-cream-dark dark:text-gray-400 dark:hover:bg-dark-hover'
										}`
									}
								>
									<item.icon size={20} />
									{item.label}
								</NavLink>
							))}
						</nav>

						<div className='p-4 bg-cream-dark dark:bg-dark-card rounded-2xl'>
							<div className='flex items-center gap-3'>
								<Avatar className='h-10 w-10'>
									<AvatarFallback className='bg-coral/10 text-coral font-bold'>
										{user?.email?.substring(0, 2).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<div className='flex-1 overflow-hidden'>
									<p className='text-sm font-semibold text-gray-900 dark:text-white truncate'>
										{user?.email?.split('@')[0]}
									</p>
									<p className='text-xs text-gray-500 dark:text-gray-400'>
										Creator
									</p>
								</div>
							</div>
						</div>
					</aside>
				</div>
			)}

			{/* Main Content */}
			<main className='flex-1 flex flex-col overflow-hidden'>
				{/* Header */}
				<header className='flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-dark-border bg-white/50 dark:bg-dark-card/50 backdrop-blur-sm'>
					{/* Left Section - Date & Greeting */}
					<div className='flex items-center gap-6'>
						<Button
							variant='ghost'
							size='icon'
							className='lg:hidden'
							onClick={() => setIsMobileSidebarOpen(true)}
						>
							<Menu size={20} />
						</Button>

						<div className='flex items-center gap-4'>
							{/* Date Widget */}
							<button
								onClick={() => navigate('/dashboard/calendar')}
								className='hidden md:flex items-center gap-3 hover:opacity-80 transition-opacity'
							>
								<div className='w-10 h-10 bg-white dark:bg-dark-card rounded-xl border border-gray-100 dark:border-dark-border flex flex-col items-center justify-center shadow-sm'>
									<span className='text-lg font-bold text-gray-900 dark:text-white leading-none'>
										{dayOfMonth}
									</span>
								</div>
								<div className='hidden lg:block'>
									<p className='text-xs font-medium text-gray-900 dark:text-white'>
										{dayName}, {monthName}
									</p>
								</div>
							</button>

							{/* Greeting */}
							<div className='hidden md:block h-8 w-px bg-gray-200 dark:bg-dark-border mx-2' />
							<h2 className='hidden md:block text-sm font-medium text-gray-900 dark:text-white'>
								Hey, {user?.email?.split('@')[0]}
							</h2>
						</div>
					</div>

					{/* Right Section */}
					<div className='flex items-center gap-2'>
						{/* Search */}
						<div className='relative hidden md:block mr-2'>
							<Search
								className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'
								size={16}
							/>
							<Input
								type='text'
								placeholder='Search...'
								className='w-56 h-9 pl-9 rounded-full bg-white dark:bg-dark-card border-gray-100 dark:border-dark-border text-sm'
							/>
						</div>

						{/* Theme Toggle */}
						<Button
							variant='ghost'
							size='icon'
							onClick={toggleTheme}
							className='rounded-full h-9 w-9'
						>
							{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
						</Button>

						{/* Notifications */}
						<Button
							variant='ghost'
							size='icon'
							className='rounded-full relative h-9 w-9'
						>
							<Bell size={18} />
							<span className='absolute top-2 right-2 w-1.5 h-1.5 bg-coral rounded-full' />
						</Button>
					</div>
				</header>

				{/* Content Area */}
				<div className='flex-1 overflow-auto p-4 scrollbar-thin'>
					<Outlet />
				</div>
			</main>
		</div>
	);
}
