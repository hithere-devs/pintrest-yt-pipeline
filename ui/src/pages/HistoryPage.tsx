import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	Youtube,
	Edit2,
	ExternalLink,
	Video,
	Calendar,
	CheckCircle2,
	XCircle,
	Clock,
	Filter,
	RefreshCw,
	Camera,
} from 'lucide-react';
import { fetchWithAuth } from '../api';
import VideoEditorModal from '../components/VideoEditorModal';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';

interface Video {
	id: string;
	pinterestUrl: string;
	status: string;
	thumbnailUrl?: string;
	youtubeTitle?: string;
	youtubeUrl?: string;
	youtubeVideoId?: string;
	downloadedAt?: string;
	uploadedAt?: string;
	youtubeDesc?: string;
	youtubeTags?: string[];
	localFilePath?: string;
}

interface DashboardData {
	history: Video[];
}

export default function HistoryPage() {
	const navigate = useNavigate();
	const [data, setData] = useState<DashboardData | null>(null);
	const [editingVideo, setEditingVideo] = useState<Video | null>(null);
	const [filter, setFilter] = useState<'all' | 'uploaded' | 'failed'>('all');
	const [retryingVideos, setRetryingVideos] = useState<Set<string>>(new Set());

	const fetchData = async () => {
		try {
			const json = await fetchWithAuth('/queue');
			setData(json);
		} catch (err) {
			console.error(err);
		}
	};

	const handleRetry = async (videoId: string) => {
		setRetryingVideos((prev) => new Set(prev).add(videoId));
		try {
			await fetchWithAuth(`/queue/${videoId}/retry`, {
				method: 'POST',
			});
			// Refresh the data after retry
			await fetchData();
		} catch (err) {
			console.error('Failed to retry video:', err);
			alert('Failed to retry video. Please try again.');
		} finally {
			setRetryingVideos((prev) => {
				const newSet = new Set(prev);
				newSet.delete(videoId);
				return newSet;
			});
		}
	};

	useEffect(() => {
		fetchData();
	}, []);

	if (!data)
		return (
			<div className='flex items-center justify-center h-full'>
				<div className='flex flex-col items-center gap-4'>
					<div className='w-12 h-12 border-4 border-coral border-t-transparent rounded-full animate-spin' />
					<p className='text-gray-500 dark:text-gray-400'>Loading history...</p>
				</div>
			</div>
		);

	const filteredHistory = data.history.filter((video) => {
		if (filter === 'all') return true;
		if (filter === 'uploaded') return video.status === 'UPLOADED';
		if (filter === 'failed') return video.status === 'FAILED';
		return true;
	});

	const uploadedCount = data.history.filter(
		(v) => v.status === 'UPLOADED'
	).length;
	const failedCount = data.history.filter((v) => v.status === 'FAILED').length;

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'UPLOADED':
				return <CheckCircle2 className='text-green-500' size={16} />;
			case 'FAILED':
				return <XCircle className='text-red-500' size={16} />;
			default:
				return <Clock className='text-gray-400' size={16} />;
		}
	};

	const getStatusStyle = (status: string) => {
		switch (status) {
			case 'UPLOADED':
				return 'text-green-600 bg-green-500/10';
			case 'FAILED':
				return 'text-red-600 bg-red-500/10';
			default:
				return 'text-gray-600 bg-gray-500/10';
		}
	};

	return (
		<div className='space-y-6'>
			{/* Header */}
			<div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
				<div>
					<h2 className='text-2xl font-bold text-gray-900 dark:text-white'>
						Processing History
					</h2>
					<p className='text-gray-500 dark:text-gray-400 text-sm mt-1'>
						View all processed videos and their upload status
					</p>
				</div>
				<div className='flex items-center gap-2'>
					<Filter size={18} className='text-gray-400' />
					<div className='flex bg-cream-dark dark:bg-dark-card rounded-xl p-1'>
						<button
							onClick={() => setFilter('all')}
							className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
								filter === 'all'
									? 'bg-white dark:bg-dark-hover text-gray-900 dark:text-white shadow-sm'
									: 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
							}`}
						>
							All ({data.history.length})
						</button>
						<button
							onClick={() => setFilter('uploaded')}
							className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
								filter === 'uploaded'
									? 'bg-white dark:bg-dark-hover text-gray-900 dark:text-white shadow-sm'
									: 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
							}`}
						>
							Uploaded ({uploadedCount})
						</button>
						<button
							onClick={() => setFilter('failed')}
							className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
								filter === 'failed'
									? 'bg-white dark:bg-dark-hover text-gray-900 dark:text-white shadow-sm'
									: 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
							}`}
						>
							Failed ({failedCount})
						</button>
					</div>
				</div>
			</div>

			{/* History Grid */}
			<Card>
				<CardHeader>
					<CardTitle className='flex items-center gap-2'>
						<Calendar className='text-coral' size={20} />
						Video History
					</CardTitle>
				</CardHeader>
				<CardContent>
					{filteredHistory.length === 0 ? (
						<div className='text-center py-16'>
							<div className='w-20 h-20 bg-gray-100 dark:bg-dark-hover rounded-full flex items-center justify-center mx-auto mb-4'>
								<Video className='text-gray-400' size={36} />
							</div>
							<h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-2'>
								No History Yet
							</h3>
							<p className='text-gray-500 dark:text-gray-400'>
								{filter !== 'all'
									? `No ${filter} videos found`
									: 'Process some videos to see them here'}
							</p>
						</div>
					) : (
						<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
							{filteredHistory.map((video) => (
								<div
									key={video.id}
									className='group bg-cream-dark dark:bg-dark-hover rounded-2xl overflow-hidden hover:shadow-lg transition-all'
								>
									{/* Thumbnail */}
									<div className='relative aspect-video'>
										{video.thumbnailUrl ? (
											<img
												src={video.thumbnailUrl}
												alt='Thumbnail'
												className='w-full h-full object-cover'
											/>
										) : (
											<div className='w-full h-full bg-gray-200 dark:bg-dark-border flex items-center justify-center'>
												<Video className='text-gray-400' size={32} />
											</div>
										)}
										{/* Status Badge */}
										<div className='absolute top-3 right-3'>
											<span
												className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm ${getStatusStyle(
													video.status
												)}`}
											>
												{getStatusIcon(video.status)}
												{video.status}
											</span>
										</div>
										{/* Hover Actions */}
										{(video.youtubeUrl || video.localFilePath) && (
											<div className='absolute inset-0 bg-black/60 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity'>
												{video.youtubeUrl && (
													<a
														href={video.youtubeUrl}
														target='_blank'
														rel='noreferrer'
														className='w-10 h-10 bg-white rounded-full flex items-center justify-center text-red-600 hover:scale-110 transition-transform'
														title='View on YouTube'
													>
														<Youtube size={20} />
													</a>
												)}
												{video.youtubeVideoId && (
													<button
														onClick={() => setEditingVideo(video)}
														className='w-10 h-10 bg-white rounded-full flex items-center justify-center text-coral hover:scale-110 transition-transform'
														title='Edit video details'
													>
														<Edit2 size={18} />
													</button>
												)}
												{video.localFilePath && (
													<button
														onClick={() =>
															navigate(`/dashboard/video/${video.id}`)
														}
														className='w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 hover:scale-110 transition-transform'
														title='Extract frames & research'
													>
														<Camera size={18} />
													</button>
												)}
											</div>
										)}
									</div>

									{/* Content */}
									<div className='p-4'>
										<h3 className='font-semibold text-gray-900 dark:text-white truncate mb-2'>
											{video.youtubeTitle || 'Untitled Video'}
										</h3>
										<div className='flex items-center justify-between text-sm'>
											<span className='text-gray-500 dark:text-gray-400'>
												{video.uploadedAt
													? new Date(video.uploadedAt).toLocaleDateString()
													: 'Processing...'}
											</span>
											<a
												href={video.pinterestUrl}
												target='_blank'
												rel='noreferrer'
												className='text-coral hover:text-coral-dark flex items-center gap-1'
											>
												Source
												<ExternalLink size={12} />
											</a>
										</div>

										{/* Retry Button for Failed Videos */}
										{video.status === 'FAILED' && (
											<div className='mt-3'>
												<Button
													onClick={() => handleRetry(video.id)}
													disabled={retryingVideos.has(video.id)}
													className='w-full bg-coral hover:bg-coral-dark text-white gap-2'
													size='sm'
												>
													{retryingVideos.has(video.id) ? (
														<>
															<RefreshCw size={14} className='animate-spin' />
															Retrying...
														</>
													) : (
														<>
															<RefreshCw size={14} />
															Retry Upload
														</>
													)}
												</Button>
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{editingVideo && (
				<VideoEditorModal
					video={editingVideo}
					onClose={() => setEditingVideo(null)}
					onSave={() => {
						setEditingVideo(null);
						fetchData();
					}}
				/>
			)}
		</div>
	);
}
