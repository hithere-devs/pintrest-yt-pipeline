import { useEffect, useState } from 'react';
import {
	Play,
	TrendingUp,
	Video,
	Clock,
	AlertCircle,
	ArrowUpRight,
	BarChart3,
	Zap,
	Gem,
} from 'lucide-react';
import { fetchWithAuth } from '../api';
import { Button } from '../components/ui/button';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '../components/ui/card';

interface Video {
	id: string;
	pinterestUrl: string;
	status: string;
	thumbnailUrl?: string;
	youtubeTitle?: string;
	youtubeUrl?: string;
}

interface DashboardData {
	queue: Video[];
	history: Video[];
	lastJobResult: any;
}

export default function DashboardHome() {
	const [data, setData] = useState<DashboardData | null>(null);
	const [loading, setLoading] = useState(false);

	const fetchData = async () => {
		try {
			const json = await fetchWithAuth('/queue');
			setData(json);
		} catch (err) {
			console.error(err);
		}
	};

	useEffect(() => {
		fetchData();
		const interval = setInterval(fetchData, 5000);
		return () => clearInterval(interval);
	}, []);

	const triggerDownload = async () => {
		setLoading(true);
		await fetchWithAuth('/trigger-download');
		setLoading(false);
		fetchData();
	};

	if (!data)
		return (
			<div className='flex items-center justify-center h-full'>
				<div className='flex flex-col items-center gap-4'>
					<div className='w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin' />
					<p className='text-gray-500 dark:text-gray-400 font-medium'>
						Loading assets...
					</p>
				</div>
			</div>
		);

	const uploadedCount = data.history.filter(
		(v) => v.status === 'UPLOADED'
	).length;
	const failedCount = data.history.filter((v) => v.status === 'FAILED').length;

	return (
		<div className='space-y-4'>
			{/* Stats Grid */}
			<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3'>
				{/* Queue Card */}
				<Card className='relative overflow-hidden bg-guilloche border-emerald-500/20'>
					<div className='absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2' />
					<CardContent className='p-4'>
						<div className='flex items-center justify-between mb-3'>
							<div className='w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center'>
								<Video className='text-emerald-500' size={20} />
							</div>
							<span className='text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full'>
								Pending
							</span>
						</div>
						<p className='text-2xl font-bold text-gray-900 dark:text-white mb-0.5 font-display'>
							{data.queue.length}
						</p>
						<p className='text-xs text-gray-500 dark:text-gray-400'>In Queue</p>
					</CardContent>
				</Card>

				{/* Uploaded Card */}
				<Card className='relative overflow-hidden border-emerald-500/20'>
					<div className='absolute top-0 right-0 w-20 h-20 bg-lime-500/5 rounded-full -translate-y-1/2 translate-x-1/2' />
					<CardContent className='p-4'>
						<div className='flex items-center justify-between mb-3'>
							<div className='w-10 h-10 bg-lime-500/10 rounded-xl flex items-center justify-center'>
								<Gem className='text-lime-500' size={20} />
							</div>
							<div className='flex items-center gap-1 text-lime-500 text-[10px] font-medium'>
								<TrendingUp size={12} />+
								{uploadedCount > 0
									? Math.round(
											(uploadedCount / (data.history.length || 1)) * 100
									  )
									: 0}
								%
							</div>
						</div>
						<p className='text-2xl font-bold text-gray-900 dark:text-white mb-0.5 font-display'>
							{uploadedCount}
						</p>
						<p className='text-xs text-gray-500 dark:text-gray-400'>Minted</p>
					</CardContent>
				</Card>

				{/* Failed Card */}
				<Card className='relative overflow-hidden border-red-500/20'>
					<div className='absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-full -translate-y-1/2 translate-x-1/2' />
					<CardContent className='p-4'>
						<div className='flex items-center justify-between mb-3'>
							<div className='w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center'>
								<AlertCircle className='text-red-500' size={20} />
							</div>
							{failedCount > 0 && (
								<span className='text-[10px] font-medium text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full'>
									Attention
								</span>
							)}
						</div>
						<p className='text-2xl font-bold text-gray-900 dark:text-white mb-0.5 font-display'>
							{failedCount}
						</p>
						<p className='text-xs text-gray-500 dark:text-gray-400'>Failed</p>
					</CardContent>
				</Card>

				{/* Last Run Card */}
				<Card className='relative overflow-hidden border-emerald-500/20'>
					<div className='absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2' />
					<CardContent className='p-4'>
						<div className='flex items-center justify-between mb-3'>
							<div className='w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center'>
								<Clock className='text-emerald-500' size={20} />
							</div>
							<span
								className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
									data.lastJobResult.status === 'completed'
										? 'text-emerald-500 bg-emerald-500/10'
										: data.lastJobResult.status === 'failed'
										? 'text-red-500 bg-red-500/10'
										: 'text-gray-500 bg-gray-500/10'
								}`}
							>
								{data.lastJobResult.status}
							</span>
						</div>
						<p className='text-lg font-bold text-gray-900 dark:text-white mb-0.5 truncate font-display'>
							{data.lastJobResult.ranAt
								? new Date(data.lastJobResult.ranAt).toLocaleTimeString([], {
										hour: '2-digit',
										minute: '2-digit',
								  })
								: 'Never'}
						</p>
						<p className='text-xs text-gray-500 dark:text-gray-400'>Last Run</p>
					</CardContent>
				</Card>
			</div>

			{/* Action & Activity Section */}
			<div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
				{/* Quick Actions */}
				<Card className='lg:col-span-1 border-emerald-500/20'>
					<CardHeader className='p-4 pb-2'>
						<CardTitle className='flex items-center gap-2 font-display text-base'>
							<Zap className='text-emerald-500' size={18} />
							Actions
						</CardTitle>
					</CardHeader>
					<CardContent className='p-4 space-y-3'>
						<Button
							onClick={triggerDownload}
							disabled={loading}
							className='btn-money w-full text-white gap-2 h-10 rounded-xl shadow-lg shadow-emerald-500/20 text-sm'
						>
							<Play size={16} className='fill-current' />
							{loading ? 'Minting...' : 'Run Pipeline'}
						</Button>
						<div className='grid grid-cols-2 gap-3'>
							<Button
								variant='outline'
								className='h-10 rounded-xl hover:border-emerald-500/50 hover:bg-emerald-500/5 text-xs'
							>
								<BarChart3 size={16} className='mr-2' />
								Analytics
							</Button>
							<Button
								variant='outline'
								className='h-10 rounded-xl hover:border-emerald-500/50 hover:bg-emerald-500/5 text-xs'
							>
								<Video size={16} className='mr-2' />
								Add Asset
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* Queue Preview */}
				<Card className='lg:col-span-2 border-emerald-500/20'>
					<CardHeader className='flex flex-row items-center justify-between p-4 pb-2'>
						<CardTitle className='font-display text-base'>Queue</CardTitle>
						<Button
							variant='ghost'
							size='sm'
							className='text-emerald-500 hover:text-emerald-400 gap-1 h-8 text-xs'
						>
							View All
							<ArrowUpRight size={14} />
						</Button>
					</CardHeader>
					<CardContent className='p-4'>
						<div className='space-y-2'>
							{data.queue.length === 0 ? (
								<div className='text-center py-4'>
									<div className='w-12 h-12 bg-gray-100 dark:bg-dark-hover rounded-full flex items-center justify-center mx-auto mb-2'>
										<Video className='text-gray-400' size={20} />
									</div>
									<p className='text-xs text-gray-500 dark:text-gray-400'>
										Queue is empty
									</p>
								</div>
							) : (
								data.queue.slice(0, 3).map((video, index) => (
									<div
										key={video.id}
										className='flex items-center gap-3 p-2 bg-cream-dark dark:bg-dark-hover rounded-lg group hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 transition-colors border border-transparent hover:border-emerald-500/20'
									>
										<div className='w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500 font-bold text-xs font-display'>
											{index + 1}
										</div>
										<div className='flex-1 min-w-0'>
											<p className='font-medium text-gray-900 dark:text-white truncate text-xs'>
												{video.pinterestUrl}
											</p>
											<span className='text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full'>
												{video.status}
											</span>
										</div>
										<ArrowUpRight
											className='text-gray-400 group-hover:text-emerald-500 transition-colors'
											size={14}
										/>
									</div>
								))
							)}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Recent Activity */}
			<Card className='border-emerald-500/20'>
				<CardHeader className='flex flex-row items-center justify-between p-4 pb-2'>
					<CardTitle className='font-display text-base'>
						Recent Activity
					</CardTitle>
					<Button
						variant='ghost'
						size='sm'
						className='text-emerald-500 hover:text-emerald-400 gap-1 h-8 text-xs'
					>
						View History
						<ArrowUpRight size={14} />
					</Button>
				</CardHeader>
				<CardContent className='p-4'>
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
						{data.history.length === 0 ? (
							<div className='col-span-full text-center py-4'>
								<p className='text-xs text-gray-500 dark:text-gray-400'>
									No recent activity
								</p>
							</div>
						) : (
							data.history.slice(0, 6).map((video) => (
								<div
									key={video.id}
									className='flex gap-3 p-3 bg-cream-dark dark:bg-dark-hover rounded-lg group hover:shadow-sm transition-all border border-transparent hover:border-emerald-500/20'
								>
									{video.thumbnailUrl ? (
										<img
											src={video.thumbnailUrl}
											alt='Thumbnail'
											className='w-16 h-10 object-cover rounded bg-gray-200 dark:bg-dark-border'
										/>
									) : (
										<div className='w-16 h-10 bg-gray-200 dark:bg-dark-border rounded flex items-center justify-center'>
											<Video className='text-gray-400' size={16} />
										</div>
									)}
									<div className='flex-1 min-w-0'>
										<p className='font-medium text-gray-900 dark:text-white truncate text-xs mb-1'>
											{video.youtubeTitle || 'Untitled Asset'}
										</p>
										<span
											className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center w-fit gap-1 ${
												video.status === 'UPLOADED'
													? 'text-lime-500 bg-lime-500/10'
													: video.status === 'FAILED'
													? 'text-red-500 bg-red-500/10'
													: 'text-gray-500 bg-gray-500/10'
											}`}
										>
											{video.status === 'UPLOADED' && (
												<Gem size={8} className='fill-current' />
											)}
											{video.status === 'UPLOADED' ? 'MINTED' : video.status}
										</span>
									</div>
								</div>
							))
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
