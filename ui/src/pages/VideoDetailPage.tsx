import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
	ArrowLeft,
	Video,
	Youtube,
	ExternalLink,
	Camera,
	Brain,
	Loader2,
	RefreshCw,
	CheckCircle2,
	XCircle,
	Clock,
	Sparkles,
	Eye,
	Trash2,
	ImageOff,
} from 'lucide-react';
import { fetchWithAuth } from '../api';
import DeepResearchPanel from '../components/DeepResearchPanel';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface VideoData {
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
	pinterestTitle?: string;
	pinterestDescription?: string;
}

interface Frame {
	id: string;
	index: number;
	timestamp: number;
	url: string;
	s3Url?: string;
	localPath?: string;
	description: string | null;
}

const FRAME_COUNT_OPTIONS = [5, 10, 15, 20, 25, 30];

export default function VideoDetailPage() {
	const { videoId } = useParams<{ videoId: string }>();
	const navigate = useNavigate();

	const [video, setVideo] = useState<VideoData | null>(null);
	const [frames, setFrames] = useState<Frame[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	// Frame extraction state
	const [frameCount, setFrameCount] = useState(5);
	const [quality, setQuality] = useState(80);
	const [analyzeFrames, setAnalyzeFrames] = useState(true);
	const [extracting, setExtracting] = useState(false);
	const [cleaning, setCleaning] = useState(false);
	const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);

	// Research state
	const [showResearch, setShowResearch] = useState(false);
	const [researchRunning, setResearchRunning] = useState(false);

	const fetchVideoData = async () => {
		if (!videoId) return;

		try {
			setLoading(true);
			const [videoData, framesData, researchData] = await Promise.all([
				fetchWithAuth(`/videos/${videoId}`),
				fetchWithAuth(`/frames/${videoId}`).catch(() => ({ frames: [] })),
				fetchWithAuth(`/research/video/${videoId}`).catch(() => ({
					exists: false,
				})),
			]);

			setVideo(videoData);
			setFrames(framesData.frames || []);

			if (researchData.exists) {
				// Auto-show research panel if there's existing research
				if (
					researchData.status === 'completed' ||
					researchData.status === 'in_progress'
				) {
					setShowResearch(true);
				}
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load video');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchVideoData();
	}, [videoId]);

	const extractFrames = async () => {
		if (!videoId) return;
		setExtracting(true);
		setError('');

		try {
			const result = await fetchWithAuth('/frames/extract', {
				method: 'POST',
				body: JSON.stringify({
					videoId,
					frameCount,
					quality,
					analyze: analyzeFrames,
				}),
			});

			setFrames(result.frames || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to extract frames');
		} finally {
			setExtracting(false);
		}
	};

	const cleanupFrames = async () => {
		if (!videoId) return;
		setCleaning(true);
		try {
			await fetchWithAuth(`/frames/${videoId}`, { method: 'DELETE' });
			setFrames([]);
			setSelectedFrame(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to cleanup frames');
		} finally {
			setCleaning(false);
		}
	};

	const formatTimestamp = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

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

	const getFrameUrl = (frame: Frame) => {
		// If the URL is already an absolute URL (S3), use it directly
		if (frame.url.startsWith('http')) return frame.url;
		// Otherwise, prepend the API URL
		return `${API_URL}${frame.url}`;
	};

	if (loading) {
		return (
			<div className='flex items-center justify-center h-full'>
				<div className='flex flex-col items-center gap-4'>
					<div className='w-12 h-12 border-4 border-coral border-t-transparent rounded-full animate-spin' />
					<p className='text-gray-500 dark:text-gray-400'>
						Loading video details...
					</p>
				</div>
			</div>
		);
	}

	if (error && !video) {
		return (
			<div className='flex items-center justify-center h-full'>
				<div className='text-center space-y-4'>
					<p className='text-red-500'>{error}</p>
					<Button onClick={() => navigate('/dashboard/history')}>
						Back to History
					</Button>
				</div>
			</div>
		);
	}

	if (!video) {
		return (
			<div className='flex items-center justify-center h-full'>
				<div className='text-center space-y-4'>
					<p className='text-gray-500'>Video not found</p>
					<Button onClick={() => navigate('/dashboard/history')}>
						Back to History
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className='space-y-6'>
			{/* Header with Back Button */}
			<div className='flex items-center gap-4'>
				<button
					onClick={() => navigate('/dashboard/history')}
					className='p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors'
				>
					<ArrowLeft size={20} className='text-gray-600 dark:text-gray-400' />
				</button>
				<div className='flex-1'>
					<h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
						{video.youtubeTitle || 'Untitled Video'}
					</h1>
					<p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
						Video details, frame extraction, and AI research
					</p>
				</div>
				<span
					className={`flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-full ${getStatusStyle(
						video.status
					)}`}
				>
					{getStatusIcon(video.status)}
					{video.status}
				</span>
			</div>

			{/* Video Info Card */}
			<Card>
				<CardContent className='p-6'>
					<div className='flex gap-6'>
						{/* Thumbnail */}
						<div className='w-64 shrink-0'>
							{video.thumbnailUrl ? (
								<img
									src={video.thumbnailUrl}
									alt='Thumbnail'
									className='w-full aspect-video object-cover rounded-xl'
								/>
							) : (
								<div className='w-full aspect-video bg-gray-200 dark:bg-dark-hover rounded-xl flex items-center justify-center'>
									<Video className='text-gray-400' size={40} />
								</div>
							)}
						</div>

						{/* Info */}
						<div className='flex-1 space-y-4'>
							<div className='grid grid-cols-2 gap-4'>
								<div>
									<label className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
										Downloaded
									</label>
									<p className='text-sm text-gray-900 dark:text-white mt-1'>
										{video.downloadedAt
											? new Date(video.downloadedAt).toLocaleString()
											: 'N/A'}
									</p>
								</div>
								<div>
									<label className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
										Uploaded
									</label>
									<p className='text-sm text-gray-900 dark:text-white mt-1'>
										{video.uploadedAt
											? new Date(video.uploadedAt).toLocaleString()
											: 'N/A'}
									</p>
								</div>
							</div>

							<div className='flex items-center gap-3'>
								<a
									href={video.pinterestUrl}
									target='_blank'
									rel='noreferrer'
									className='inline-flex items-center gap-2 text-sm text-coral hover:text-coral-dark transition-colors'
								>
									<ExternalLink size={14} />
									Pinterest Source
								</a>
								{video.youtubeUrl && (
									<a
										href={video.youtubeUrl}
										target='_blank'
										rel='noreferrer'
										className='inline-flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors'
									>
										<Youtube size={14} />
										View on YouTube
									</a>
								)}
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Frame Extraction Section */}
			<Card>
				<CardHeader>
					<CardTitle className='flex items-center gap-2'>
						<Camera className='text-coral' size={20} />
						Frame Extraction
					</CardTitle>
				</CardHeader>
				<CardContent className='space-y-6'>
					{/* Controls */}
					<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
						<div className='space-y-2'>
							<label className='block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
								Frame Count
							</label>
							<select
								value={frameCount}
								onChange={(e) => setFrameCount(Number(e.target.value))}
								className='w-full bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-coral/50 focus:border-coral/50 outline-none'
								disabled={extracting}
							>
								{FRAME_COUNT_OPTIONS.map((count) => (
									<option key={count} value={count}>
										{count} frames
									</option>
								))}
							</select>
						</div>

						<div className='space-y-2'>
							<label className='block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
								Quality ({quality}%)
							</label>
							<input
								type='range'
								min='50'
								max='100'
								value={quality}
								onChange={(e) => setQuality(Number(e.target.value))}
								className='w-full accent-coral mt-3'
								disabled={extracting}
							/>
						</div>

						<div className='space-y-2'>
							<label className='block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
								Options
							</label>
							<label className='flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl cursor-pointer hover:border-coral/30 transition-colors'>
								<input
									type='checkbox'
									checked={analyzeFrames}
									onChange={(e) => setAnalyzeFrames(e.target.checked)}
									className='w-4 h-4 rounded border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-coral focus:ring-coral/50'
									disabled={extracting}
								/>
								<div className='flex items-center gap-2'>
									<Sparkles size={16} className='text-coral' />
									<span className='text-sm text-gray-900 dark:text-white'>
										AI Analysis
									</span>
								</div>
							</label>
						</div>
					</div>

					{/* Action Buttons */}
					<div className='flex items-center gap-3'>
						<Button
							onClick={extractFrames}
							disabled={extracting || !video.localFilePath || researchRunning}
							className='flex-1 bg-coral hover:bg-coral-dark text-white gap-2'
						>
							{extracting ? (
								<>
									<Loader2 size={18} className='animate-spin' />
									Extracting Frames...
								</>
							) : (
								<>
									<Camera size={18} />
									Extract Frames
								</>
							)}
						</Button>

						{frames.length > 0 && (
							<>
								<Button
									onClick={cleanupFrames}
									disabled={cleaning}
									variant='outline'
									className='text-red-500 border-red-500/30 hover:bg-red-500/10'
								>
									{cleaning ? (
										<Loader2 size={18} className='animate-spin' />
									) : (
										<Trash2 size={18} />
									)}
								</Button>
								<Button
									onClick={extractFrames}
									disabled={extracting}
									variant='outline'
									title='Re-extract frames'
								>
									<RefreshCw size={18} />
								</Button>
							</>
						)}
					</div>

					{!video.localFilePath && (
						<p className='text-sm text-amber-500'>
							Local video file not available. Frame extraction requires the
							video to be downloaded.
						</p>
					)}

					{researchRunning && (
						<p className='text-sm text-amber-500'>
							⚠️ Frame extraction is disabled while Deep Research is running.
						</p>
					)}

					{/* Error Display */}
					{error && (
						<div className='bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm'>
							{error}
						</div>
					)}

					{/* Frames Grid */}
					{frames.length > 0 && (
						<div className='space-y-4'>
							<div className='flex items-center justify-between'>
								<h4 className='text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
									Extracted Frames ({frames.length})
								</h4>
							</div>

							<div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4'>
								{frames.map((frame) => (
									<div
										key={frame.id || frame.index}
										className={`relative group aspect-video bg-gray-100 dark:bg-dark-bg rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
											selectedFrame?.index === frame.index
												? 'border-coral shadow-lg shadow-coral/20'
												: 'border-gray-200 dark:border-dark-border hover:border-coral/50'
										}`}
										onClick={() => setSelectedFrame(frame)}
									>
										<img
											src={getFrameUrl(frame)}
											alt={`Frame ${frame.index}`}
											className='w-full h-full object-cover'
										/>
										<div className='absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity' />
										<div className='absolute bottom-0 left-0 right-0 p-2 flex items-center justify-between'>
											<span className='text-xs font-medium text-white/90 bg-black/50 px-2 py-1 rounded'>
												{formatTimestamp(frame.timestamp)}
											</span>
											{frame.description && (
												<span className='bg-coral/80 p-1 rounded'>
													<Sparkles size={10} className='text-white' />
												</span>
											)}
										</div>
										<div className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity'>
											<Eye size={16} className='text-white' />
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Selected Frame Detail */}
					{selectedFrame && (
						<div className='bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-4 space-y-4'>
							<div className='flex items-start gap-4'>
								<img
									src={getFrameUrl(selectedFrame)}
									alt={`Frame ${selectedFrame.index}`}
									className='w-48 h-auto rounded-lg object-cover'
								/>
								<div className='flex-1 space-y-2'>
									<div className='flex items-center gap-2'>
										<span className='text-sm font-medium text-gray-900 dark:text-white'>
											Frame {selectedFrame.index + 1}
										</span>
										<span className='text-xs text-gray-500'>
											@ {formatTimestamp(selectedFrame.timestamp)}
										</span>
									</div>
									{selectedFrame.description ? (
										<p className='text-sm text-gray-700 dark:text-gray-300 leading-relaxed'>
											{selectedFrame.description}
										</p>
									) : (
										<p className='text-sm text-gray-500 italic'>
											No AI analysis available. Enable "AI Analysis" and
											re-extract.
										</p>
									)}
								</div>
							</div>
						</div>
					)}

					{/* Empty State */}
					{frames.length === 0 && !extracting && (
						<div className='text-center py-12 space-y-3'>
							<div className='w-16 h-16 mx-auto rounded-2xl bg-gray-100 dark:bg-dark-bg flex items-center justify-center'>
								<ImageOff className='w-8 h-8 text-gray-400' />
							</div>
							<p className='text-gray-500 dark:text-gray-400'>
								No frames extracted yet
							</p>
							<p className='text-sm text-gray-400 dark:text-gray-500'>
								Select frame count and click "Extract Frames" to begin
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Deep Research Section */}
			{frames.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className='flex items-center gap-2'>
							<Brain className='text-purple-500' size={20} />
							Deep Research
						</CardTitle>
					</CardHeader>
					<CardContent>
						{!showResearch ? (
							<button
								onClick={() => setShowResearch(true)}
								className='w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-coral/10 to-purple-500/10 hover:from-coral/20 hover:to-purple-500/20 border border-coral/30 text-gray-900 dark:text-white rounded-xl font-medium transition-all'
							>
								<Brain size={20} className='text-coral' />
								<span>Start Deep Research</span>
								<span className='text-xs text-gray-500 dark:text-gray-400 ml-2'>
									Generate title, description, hashtags & thumbnail prompt
								</span>
							</button>
						) : (
							<DeepResearchPanel
								videoId={video.id}
								frames={frames.map((f) => ({
									index: f.index,
									timestamp: f.timestamp,
									url: getFrameUrl(f),
									description: f.description,
								}))}
								youtubeVideoId={video.youtubeVideoId}
								onUpdate={fetchVideoData}
								onClose={() => setShowResearch(false)}
								onResearchStatusChange={setResearchRunning}
							/>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
