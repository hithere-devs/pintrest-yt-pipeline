import { useState } from 'react';
import {
	Camera,
	Loader2,
	Trash2,
	Eye,
	ImageOff,
	RefreshCw,
	Sparkles,
	Brain,
} from 'lucide-react';
import { fetchWithAuth } from '../api';
import DeepResearchPanel from './DeepResearchPanel';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface ExtractedFrame {
	index: number;
	timestamp: number;
	url: string;
	description: string | null;
}

interface FrameExtractionResult {
	success: boolean;
	videoId: string;
	frameCount: number;
	frames: ExtractedFrame[];
}

interface Props {
	videoId: string;
	youtubeVideoId?: string;
	onFramesExtracted?: (frames: ExtractedFrame[]) => void;
	onClose?: () => void;
	onUpdate?: () => void;
	compact?: boolean;
}

const FRAME_COUNT_OPTIONS = [5, 10, 15, 20, 25, 30];

export default function FrameExtractor({
	videoId,
	youtubeVideoId,
	onFramesExtracted,
	onClose,
	onUpdate,
	compact = false,
}: Props) {
	const [frameCount, setFrameCount] = useState(5);
	const [quality, setQuality] = useState(80);
	const [analyzeFrames, setAnalyzeFrames] = useState(true); // Default to true for deep research
	const [extracting, setExtracting] = useState(false);
	const [frames, setFrames] = useState<ExtractedFrame[]>([]);
	const [error, setError] = useState('');
	const [selectedFrame, setSelectedFrame] = useState<ExtractedFrame | null>(
		null
	);
	const [cleaning, setCleaning] = useState(false);
	const [showResearch, setShowResearch] = useState(false);

	const extractFrames = async () => {
		setExtracting(true);
		setError('');
		setFrames([]);

		try {
			const result = (await fetchWithAuth('/frames/extract', {
				method: 'POST',
				body: JSON.stringify({
					videoId,
					frameCount,
					quality,
					analyze: analyzeFrames,
				}),
			})) as FrameExtractionResult;

			setFrames(result.frames);
			onFramesExtracted?.(result.frames);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to extract frames');
		} finally {
			setExtracting(false);
		}
	};

	const cleanupFrames = async () => {
		setCleaning(true);
		try {
			await fetchWithAuth(`/frames/${videoId}`, { method: 'DELETE' });
			setFrames([]);
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

	if (compact) {
		return (
			<div className='space-y-4'>
				<div className='flex items-center gap-4'>
					<select
						value={frameCount}
						onChange={(e) => setFrameCount(Number(e.target.value))}
						className='bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-coral/50 focus:border-coral/50 outline-none'
						disabled={extracting}
					>
						{FRAME_COUNT_OPTIONS.map((count) => (
							<option key={count} value={count}>
								{count} frames
							</option>
						))}
					</select>

					<label className='flex items-center gap-2 text-sm text-gray-400 cursor-pointer'>
						<input
							type='checkbox'
							checked={analyzeFrames}
							onChange={(e) => setAnalyzeFrames(e.target.checked)}
							className='w-4 h-4 rounded border-dark-border bg-dark-bg text-coral focus:ring-coral/50'
							disabled={extracting}
						/>
						<Sparkles size={14} />
						AI Analysis
					</label>

					<button
						onClick={extractFrames}
						disabled={extracting}
						className='flex items-center gap-2 px-4 py-2 bg-coral hover:bg-coral-light text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed'
					>
						{extracting ? (
							<>
								<Loader2 size={16} className='animate-spin' />
								Extracting...
							</>
						) : (
							<>
								<Camera size={16} />
								Extract
							</>
						)}
					</button>
				</div>

				{error && (
					<div className='bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm'>
						{error}
					</div>
				)}

				{frames.length > 0 && (
					<div className='grid grid-cols-5 gap-2'>
						{frames.map((frame) => (
							<div
								key={frame.index}
								className='relative group aspect-video bg-dark-bg rounded-lg overflow-hidden cursor-pointer border border-dark-border hover:border-coral/50 transition-colors'
								onClick={() => setSelectedFrame(frame)}
							>
								<img
									src={`${API_URL}${frame.url}`}
									alt={`Frame ${frame.index}`}
									className='w-full h-full object-cover'
									onError={(e) => {
										(e.target as HTMLImageElement).src =
											'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="12" fill="%236b7280">Error</text></svg>';
									}}
								/>
								<div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1'>
									<span className='text-xs text-white/80'>
										{formatTimestamp(frame.timestamp)}
									</span>
								</div>
								{frame.description && (
									<div className='absolute top-1 right-1'>
										<Sparkles size={12} className='text-coral' />
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className='bg-dark-card border border-dark-border rounded-2xl overflow-hidden'>
			<div className='p-6 border-b border-dark-border'>
				<div className='flex items-center justify-between'>
					<div className='flex items-center gap-3'>
						<div className='w-10 h-10 rounded-xl bg-coral/10 flex items-center justify-center'>
							<Camera className='w-5 h-5 text-coral' />
						</div>
						<div>
							<h3 className='text-lg font-bold text-white'>Frame Extraction</h3>
							<p className='text-sm text-gray-400'>
								Extract frames from your video
							</p>
						</div>
					</div>
					{onClose && (
						<button
							onClick={onClose}
							className='text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg'
						>
							×
						</button>
					)}
				</div>
			</div>

			<div className='p-6 space-y-6'>
				{/* Controls */}
				<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
					<div className='space-y-2'>
						<label className='block text-xs font-medium text-gray-400 uppercase tracking-wider'>
							Frame Count
						</label>
						<select
							value={frameCount}
							onChange={(e) => setFrameCount(Number(e.target.value))}
							className='w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-coral/50 focus:border-coral/50 outline-none'
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
						<label className='block text-xs font-medium text-gray-400 uppercase tracking-wider'>
							Quality ({quality}%)
						</label>
						<input
							type='range'
							min='50'
							max='100'
							value={quality}
							onChange={(e) => setQuality(Number(e.target.value))}
							className='w-full accent-coral'
							disabled={extracting}
						/>
					</div>

					<div className='space-y-2'>
						<label className='block text-xs font-medium text-gray-400 uppercase tracking-wider'>
							Options
						</label>
						<label className='flex items-center gap-3 p-3 bg-dark-bg border border-dark-border rounded-xl cursor-pointer hover:border-coral/30 transition-colors'>
							<input
								type='checkbox'
								checked={analyzeFrames}
								onChange={(e) => setAnalyzeFrames(e.target.checked)}
								className='w-4 h-4 rounded border-dark-border bg-dark-bg text-coral focus:ring-coral/50'
								disabled={extracting}
							/>
							<div className='flex items-center gap-2'>
								<Sparkles size={16} className='text-coral' />
								<span className='text-sm text-white'>AI Analysis</span>
							</div>
						</label>
					</div>
				</div>

				{/* Action Buttons */}
				<div className='flex items-center gap-3'>
					<button
						onClick={extractFrames}
						disabled={extracting}
						className='flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-coral hover:bg-coral-light text-white rounded-xl font-medium transition-all shadow-lg shadow-coral/20 disabled:opacity-50 disabled:cursor-not-allowed'
					>
						{extracting ? (
							<>
								<Loader2 size={18} className='animate-spin' />
								<span>Extracting Frames...</span>
							</>
						) : (
							<>
								<Camera size={18} />
								<span>Extract Frames</span>
							</>
						)}
					</button>

					{frames.length > 0 && (
						<button
							onClick={cleanupFrames}
							disabled={cleaning}
							className='flex items-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-medium transition-all'
						>
							{cleaning ? (
								<Loader2 size={18} className='animate-spin' />
							) : (
								<Trash2 size={18} />
							)}
						</button>
					)}

					{frames.length > 0 && (
						<button
							onClick={extractFrames}
							disabled={extracting}
							className='flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-all'
							title='Re-extract frames'
						>
							<RefreshCw size={18} />
						</button>
					)}
				</div>

				{/* Error Display */}
				{error && (
					<div className='bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm'>
						{error}
					</div>
				)}

				{/* Frames Grid */}
				{frames.length > 0 && (
					<div className='space-y-4'>
						<div className='flex items-center justify-between'>
							<h4 className='text-sm font-medium text-gray-400 uppercase tracking-wider'>
								Extracted Frames ({frames.length})
							</h4>
						</div>

						<div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4'>
							{frames.map((frame) => (
								<div
									key={frame.index}
									className={`relative group aspect-video bg-dark-bg rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
										selectedFrame?.index === frame.index
											? 'border-coral shadow-lg shadow-coral/20'
											: 'border-dark-border hover:border-coral/50'
									}`}
									onClick={() => setSelectedFrame(frame)}
								>
									<img
										src={`${API_URL}${frame.url}`}
										alt={`Frame ${frame.index}`}
										className='w-full h-full object-cover'
										onError={(e) => {
											const target = e.target as HTMLImageElement;
											target.parentElement!.innerHTML = `
                                                <div class="w-full h-full flex items-center justify-center text-gray-500">
                                                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                                    </svg>
                                                </div>
                                            `;
										}}
									/>
									<div className='absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity' />
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
					<div className='bg-dark-bg border border-dark-border rounded-xl p-4 space-y-4'>
						<div className='flex items-start gap-4'>
							<img
								src={`${API_URL}${selectedFrame.url}`}
								alt={`Frame ${selectedFrame.index}`}
								className='w-48 h-auto rounded-lg object-cover'
							/>
							<div className='flex-1 space-y-2'>
								<div className='flex items-center gap-2'>
									<span className='text-sm font-medium text-white'>
										Frame {selectedFrame.index + 1}
									</span>
									<span className='text-xs text-gray-500'>
										@ {formatTimestamp(selectedFrame.timestamp)}
									</span>
								</div>
								{selectedFrame.description ? (
									<p className='text-sm text-gray-300 leading-relaxed'>
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
				{frames.length === 0 && !extracting && !error && (
					<div className='text-center py-12 space-y-3'>
						<div className='w-16 h-16 mx-auto rounded-2xl bg-dark-bg flex items-center justify-center'>
							<ImageOff className='w-8 h-8 text-gray-500' />
						</div>
						<p className='text-gray-400'>No frames extracted yet</p>
						<p className='text-sm text-gray-500'>
							Select frame count and click "Extract Frames" to begin
						</p>
					</div>
				)}

				{/* Deep Research Section */}
				{frames.length > 0 && !showResearch && (
					<div className='border-t border-dark-border pt-6'>
						<button
							onClick={() => setShowResearch(true)}
							className='w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-coral/10 to-purple-500/10 hover:from-coral/20 hover:to-purple-500/20 border border-coral/30 text-white rounded-xl font-medium transition-all'
						>
							<Brain size={20} className='text-coral' />
							<span>Start Deep Research</span>
							<span className='text-xs text-gray-400 ml-2'>
								Generate title, description, hashtags & thumbnail prompt
							</span>
						</button>
					</div>
				)}

				{frames.length > 0 && showResearch && (
					<div className='border-t border-dark-border pt-6'>
						<DeepResearchPanel
							videoId={videoId}
							frames={frames}
							youtubeVideoId={youtubeVideoId}
							onUpdate={onUpdate}
							onClose={() => setShowResearch(false)}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
