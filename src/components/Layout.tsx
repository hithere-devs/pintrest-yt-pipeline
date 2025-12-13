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
			<aside className='hidden lg:flex w-72 flex-col p-6 border-r border-gray-100 dark:border-dark-border'>
				{/* Logo */}
				<div className='flex items-center gap-3 px-2 mb-8'>
					<div className='w-10 h-10 bg-coral rounded-xl flex items-center justify-center shadow-lg shadow-coral/20'>
						<Sparkles size={20} className='text-white' fill='currentColor' />
					</div>
					<div>
						<h1 className='text-xl font-bold text-gray-900 dark:text-white'>
							ClipForge
						</h1>
						<p className='text-xs text-gray-500 dark:text-gray-400'>
							Content Dashboard
						</p>
					</div>
				</div>

				{/* Navigation */}
				<nav className='flex-1 space-y-1'>
					{navItems.map((item) => (
						<NavLink
							key={item.path}
							to={item.path}
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

				{/* Help Card */}
				<div className='mb-4 p-4 bg-coral/5 dark:bg-coral/10 rounded-2xl border border-coral/10'>
					<div className='flex items-center gap-3 mb-3'>
						<div className='w-8 h-8 bg-coral/10 rounded-full flex items-center justify-center'>
							<HelpCircle size={16} className='text-coral' />
						</div>
						<span className='font-semibold text-gray-900 dark:text-white text-sm'>
							Need help?
						</span>
					</div>
					<p className='text-xs text-gray-500 dark:text-gray-400 mb-3'>
						Check our documentation for guides and FAQs.
					</p>
					<Button variant='outline' size='sm' className='w-full text-xs'>
						View Docs
					</Button>
				</div>

				{/* User Profile Section */}
				<div className='p-4 bg-cream-dark dark:bg-dark-card rounded-2xl'>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button className='flex items-center gap-3 w-full text-left hover:opacity-80 transition-opacity'>
								<Avatar className='h-10 w-10 border-2 border-coral/20'>
									<AvatarImage
										src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
									/>
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
								<ChevronDown size={16} className='text-gray-400' />
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
									ClipForge
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
				<header className='flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-dark-border bg-white/50 dark:bg-dark-card/50 backdrop-blur-sm'>
					{/* Left Section - Date */}
					<div className='flex items-center gap-6'>
						<Button
							variant='ghost'
							size='icon'
							className='lg:hidden'
							onClick={() => setIsMobileSidebarOpen(true)}
						>
							<Menu size={20} />
						</Button>

						{/* Date Widget - clickable to navigate to calendar */}
						<button
							onClick={() => navigate('/dashboard/calendar')}
							className='hidden md:flex items-center gap-3 hover:opacity-80 transition-opacity'
						>
							<div className='w-14 h-14 bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border flex flex-col items-center justify-center shadow-sm'>
								<span className='text-2xl font-bold text-gray-900 dark:text-white leading-none'>
									{dayOfMonth}
								</span>
							</div>
							<div>
								<p className='text-sm font-medium text-gray-900 dark:text-white'>
									{dayName},
								</p>
								<p className='text-sm text-gray-500 dark:text-gray-400'>
									{monthName}
								</p>
							</div>
						</button>
					</div>

					{/* Center Section - Welcome Message (hidden on mobile) */}
					<div className='hidden xl:block text-center'>
						<h2 className='text-xl font-bold text-gray-900 dark:text-white'>
							Hey, Need help? 👋
						</h2>
						<p className='text-sm text-gray-500 dark:text-gray-400'>
							Just ask me anything!
						</p>
					</div>

					{/* Right Section */}
					<div className='flex items-center gap-3'>
						{/* Search */}
						<div className='relative hidden md:block'>
							<Search
								className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'
								size={18}
							/>
							<Input
								type='text'
								placeholder='Start searching here...'
								className='w-64 pl-10 rounded-full bg-white dark:bg-dark-card border-gray-100 dark:border-dark-border'
							/>
						</div>

						{/* Theme Toggle */}
						<Button
							variant='ghost'
							size='icon'
							onClick={toggleTheme}
							className='rounded-full'
						>
							{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
						</Button>

						{/* Notifications */}
						<Button
							variant='ghost'
							size='icon'
							className='rounded-full relative'
						>
							<Bell size={20} />
							<span className='absolute top-1 right-1 w-2 h-2 bg-coral rounded-full' />
						</Button>

						{/* User Avatar (Desktop) */}
						<div className='hidden lg:block'>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button className='flex items-center gap-2 hover:opacity-80 transition-opacity'>
										<Avatar className='h-9 w-9 border-2 border-gray-100 dark:border-dark-border'>
											<AvatarImage
												src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
											/>
											<AvatarFallback className='bg-coral/10 text-coral font-bold text-sm'>
												{user?.email?.substring(0, 2).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<div className='text-left'>
											<p className='text-sm font-medium text-gray-900 dark:text-white'>
												{user?.email?.split('@')[0]}
											</p>
											<p className='text-xs text-gray-500 dark:text-gray-400'>
												Creator
											</p>
										</div>
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
					</div>
				</header>

				{/* Content Area */}
				<div className='flex-1 overflow-auto p-6 scrollbar-thin'>
					<Outlet />
				</div>
			</main>
		</div>
	);
}
