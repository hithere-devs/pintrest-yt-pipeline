import { useState, useEffect, useCallback } from 'react';
import {
	Sparkles,
	Loader2,
	Copy,
	Check,
	RefreshCw,
	Save,
	Hash,
	FileText,
	Type,
	Palette,
	X,
	Image,
	Download,
	ExternalLink,
} from 'lucide-react';
import { fetchWithAuth } from '../api';
import MarkdownViewer from './MarkdownViewer';

interface ExtractedFrame {
	index: number;
	timestamp: number;
	url: string;
	description: string | null;
}

interface ResearchResult {
	title: string;
	description: string;
	hashtags: string[];
	thumbnailPrompt: string;
	researchInsights: string;
	theme: string;
}

interface ResearchTask {
	id: string;
	videoId: string;
	status: 'pending' | 'in_progress' | 'completed' | 'failed';
	result?: ResearchResult;
	error?: string;
	startedAt: string;
	completedAt?: string;
}

interface Props {
	videoId: string;
	frames: ExtractedFrame[];
	youtubeVideoId?: string;
	onUpdate?: () => void;
	onClose?: () => void;
	onResearchStatusChange?: (isRunning: boolean) => void;
}

export default function DeepResearchPanel({
	videoId,
	frames,
	youtubeVideoId,
	onUpdate,
	onResearchStatusChange,
}: Props) {
	const [taskId, setTaskId] = useState<string | null>(null);
	const [task, setTask] = useState<ResearchTask | null>(null);
	const [polling, setPolling] = useState(false);
	const [error, setError] = useState('');
	const [checkingExisting, setCheckingExisting] = useState(true);
	const [cancelling, setCancelling] = useState(false);

	// Editable fields
	const [editedTitle, setEditedTitle] = useState('');
	const [editedDescription, setEditedDescription] = useState('');
	const [editedHashtags, setEditedHashtags] = useState<string[]>([]);
	const [newHashtag, setNewHashtag] = useState('');
	const [thumbnailPrompt, setThumbnailPrompt] = useState('');

	// UI States
	const [extracting, setExtracting] = useState(false);
	const [extractionFailed, setExtractionFailed] = useState(false);
	const [updatingYouTube, setUpdatingYouTube] = useState(false);
	const [copiedField, setCopiedField] = useState<string | null>(null);
	const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
	const [thumbnailImageUrl, setThumbnailImageUrl] = useState<string | null>(
		null
	);
	const [thumbnailError, setThumbnailError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState('');

	// Check for existing research on mount
	useEffect(() => {
		const checkExistingResearch = async () => {
			try {
				const response = await fetchWithAuth(`/research/video/${videoId}`);
				if (response.exists) {
					setTaskId(response.id);
					setTask(response);

					// If in progress, start polling and notify parent
					if (
						response.status === 'pending' ||
						response.status === 'in_progress'
					) {
						setPolling(true);
						onResearchStatusChange?.(true);
					}

					// If completed, check if we have structured data
					if (response.status === 'completed' && response.result) {
						const hasStructuredData =
							response.result.title || response.result.description;

						if (hasStructuredData) {
							// Populate fields with existing data
							setEditedTitle(response.result.title || '');
							setEditedDescription(response.result.description || '');
							setEditedHashtags(response.result.hashtags || []);
							setThumbnailPrompt(response.result.thumbnailPrompt || '');
						} else if (response.result.researchInsights) {
							// No structured data but has raw research - auto-extract
							setCheckingExisting(false);
							setExtracting(true);

							try {
								const extractResponse = await fetchWithAuth(
									'/research/extract',
									{
										method: 'POST',
										body: JSON.stringify({ taskId: response.id }),
									}
								);

								if (extractResponse.success && extractResponse.extracted) {
									setEditedTitle(extractResponse.extracted.title || '');
									setEditedDescription(
										extractResponse.extracted.description || ''
									);
									setEditedHashtags(extractResponse.extracted.hashtags || []);
									setThumbnailPrompt(
										extractResponse.extracted.thumbnailPrompt || ''
									);

									// Update the task with new result
									setTask((prev) =>
										prev
											? {
													...prev,
													result: {
														...prev.result!,
														title: extractResponse.extracted.title,
														description: extractResponse.extracted.description,
														hashtags: extractResponse.extracted.hashtags,
														thumbnailPrompt:
															extractResponse.extracted.thumbnailPrompt,
													},
											  }
											: null
									);
								}
							} catch (extractErr) {
								console.error('Failed to auto-extract:', extractErr);
								setExtractionFailed(true);
							} finally {
								setExtracting(false);
							}
							return;
						}
					}
				}
			} catch (err) {
				console.error('Failed to check existing research:', err);
			} finally {
				setCheckingExisting(false);
			}
		};

		checkExistingResearch();
	}, [videoId, onResearchStatusChange]);

	// Manual retry extraction - wrapped in useCallback for use in useEffect
	const retryExtraction = useCallback(async () => {
		if (!taskId) return;

		setExtracting(true);
		setExtractionFailed(false);
		setError('');

		try {
			const extractResponse = await fetchWithAuth('/research/extract', {
				method: 'POST',
				body: JSON.stringify({ taskId }),
			});

			if (extractResponse.success && extractResponse.extracted) {
				setEditedTitle(extractResponse.extracted.title || '');
				setEditedDescription(extractResponse.extracted.description || '');
				setEditedHashtags(extractResponse.extracted.hashtags || []);
				setThumbnailPrompt(extractResponse.extracted.thumbnailPrompt || '');

				setTask((prev) =>
					prev
						? {
								...prev,
								result: {
									...prev.result!,
									title: extractResponse.extracted.title,
									description: extractResponse.extracted.description,
									hashtags: extractResponse.extracted.hashtags,
									thumbnailPrompt: extractResponse.extracted.thumbnailPrompt,
								},
						  }
						: null
				);

				setSuccessMessage('Successfully extracted data!');
				setTimeout(() => setSuccessMessage(''), 3000);
			} else {
				throw new Error('Extraction returned no data');
			}
		} catch (err) {
			console.error('Failed to extract:', err);
			setExtractionFailed(true);
			setError(err instanceof Error ? err.message : 'Failed to extract data');
		} finally {
			setExtracting(false);
		}
	}, [taskId]);

	// Start the research
	const startResearch = async () => {
		setError('');
		setTask(null);

		try {
			const response = await fetchWithAuth('/research/video', {
				method: 'POST',
				body: JSON.stringify({ videoId, frames }),
			});

			setTaskId(response.taskId);
			setPolling(true);
			onResearchStatusChange?.(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to start research');
		}
	};

	// Cancel the research
	const cancelResearch = async () => {
		if (!taskId) return;

		setCancelling(true);
		setError('');

		try {
			await fetchWithAuth(`/research/task/${taskId}`, {
				method: 'DELETE',
			});

			setTaskId(null);
			setTask(null);
			setPolling(false);
			onResearchStatusChange?.(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Failed to cancel research'
			);
		} finally {
			setCancelling(false);
		}
	};

	// Poll for research status
	const pollStatus = useCallback(async () => {
		if (!taskId) return;

		try {
			const response = await fetchWithAuth(`/research/task/${taskId}`);
			setTask(response);

			if (response.status === 'completed' && response.result) {
				const hasStructuredData =
					response.result.title || response.result.description;

				if (hasStructuredData) {
					setEditedTitle(response.result.title || '');
					setEditedDescription(response.result.description || '');
					setEditedHashtags(response.result.hashtags || []);
					setThumbnailPrompt(response.result.thumbnailPrompt || '');
					setPolling(false);
					onResearchStatusChange?.(false);
				} else if (response.result.researchInsights) {
					// Research completed but no structured data - auto-extract
					setPolling(false);
					onResearchStatusChange?.(false);
					setExtracting(true);

					try {
						const extractResponse = await fetchWithAuth('/research/extract', {
							method: 'POST',
							body: JSON.stringify({ taskId: response.id }),
						});

						if (extractResponse.success && extractResponse.extracted) {
							setEditedTitle(extractResponse.extracted.title || '');
							setEditedDescription(extractResponse.extracted.description || '');
							setEditedHashtags(extractResponse.extracted.hashtags || []);
							setThumbnailPrompt(
								extractResponse.extracted.thumbnailPrompt || ''
							);

							// Update the task with new result
							setTask((prev) =>
								prev
									? {
											...prev,
											result: {
												...prev.result!,
												title: extractResponse.extracted.title,
												description: extractResponse.extracted.description,
												hashtags: extractResponse.extracted.hashtags,
												thumbnailPrompt:
													extractResponse.extracted.thumbnailPrompt,
											},
									  }
									: null
							);
						}
					} catch (extractErr) {
						console.error('Failed to auto-extract:', extractErr);
						setExtractionFailed(true);
					} finally {
						setExtracting(false);
					}
				} else {
					setPolling(false);
					onResearchStatusChange?.(false);
				}
			} else if (response.status === 'failed') {
				setError(response.error || 'Research failed');
				setPolling(false);
				onResearchStatusChange?.(false);
			}
		} catch (err) {
			console.error('Failed to poll status:', err);
		}
	}, [taskId, onResearchStatusChange]);

	useEffect(() => {
		if (!polling || !taskId) return;

		const interval = setInterval(pollStatus, 3000);
		pollStatus(); // Initial poll

		return () => clearInterval(interval);
	}, [polling, taskId, pollStatus]);

	// Auto-extract when research completes but has no structured data
	useEffect(() => {
		const hasStructuredData = editedTitle || editedDescription;
		const hasRawResearch = task?.result?.researchInsights;
		const isCompleted = task?.status === 'completed';

		// If research completed, has raw data, no structured data, not extracting, and extraction hasn't failed
		if (
			isCompleted &&
			hasRawResearch &&
			!hasStructuredData &&
			!extracting &&
			!extractionFailed &&
			taskId
		) {
			retryExtraction();
		}
	}, [
		task?.status,
		task?.result?.researchInsights,
		editedTitle,
		editedDescription,
		extracting,
		extractionFailed,
		taskId,
		retryExtraction,
	]);

	// Copy to clipboard
	const copyToClipboard = async (text: string, field: string) => {
		await navigator.clipboard.writeText(text);
		setCopiedField(field);
		setTimeout(() => setCopiedField(null), 2000);
	};

	// Generate thumbnail using AI
	const generateThumbnail = async () => {
		if (!thumbnailPrompt) {
			setError('Thumbnail prompt is required');
			return;
		}

		setGeneratingThumbnail(true);
		setThumbnailError(null);

		try {
			const response = await fetchWithAuth('/thumbnail/generate', {
				method: 'POST',
				body: JSON.stringify({ prompt: thumbnailPrompt, videoId }),
			});

			if (response.success && response.imageUrl) {
				setThumbnailImageUrl(response.imageUrl);
			} else {
				throw new Error('No image URL returned');
			}
		} catch (err) {
			const errorMsg =
				err instanceof Error ? err.message : 'Failed to generate thumbnail';
			setThumbnailError(errorMsg);
		} finally {
			setGeneratingThumbnail(false);
		}
	};

	// Download thumbnail
	const downloadThumbnail = async () => {
		if (!thumbnailImageUrl) return;

		try {
			// Handle both base64 data URLs and regular URLs
			if (thumbnailImageUrl.startsWith('data:')) {
				// Convert base64 to blob
				const response = await fetch(thumbnailImageUrl);
				const blob = await response.blob();
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `thumbnail-${videoId}-${Date.now()}.png`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				window.URL.revokeObjectURL(url);
			} else {
				// Regular URL
				const response = await fetch(thumbnailImageUrl);
				const blob = await response.blob();
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `thumbnail-${videoId}-${Date.now()}.png`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				window.URL.revokeObjectURL(url);
			}
		} catch (err) {
			setError('Failed to download thumbnail');
		}
	};

	// Open thumbnail in new tab (handles base64 data URLs)
	const openThumbnailFullSize = async () => {
		if (!thumbnailImageUrl) return;

		try {
			// Convert to blob URL for opening in new tab (works better than raw base64)
			const response = await fetch(thumbnailImageUrl);
			const blob = await response.blob();
			const blobUrl = window.URL.createObjectURL(blob);
			window.open(blobUrl, '_blank');
		} catch (err) {
			// Fallback: try opening the URL directly
			window.open(thumbnailImageUrl, '_blank');
		}
	};

	// Update YouTube video metadata
	const updateYouTube = async () => {
		if (!youtubeVideoId) {
			setError('No YouTube video ID available');
			return;
		}

		setUpdatingYouTube(true);
		setError('');

		try {
			const fullDescription = `${editedDescription}\n\n${editedHashtags.join(
				' '
			)}`;

			await fetchWithAuth(`/videos/${youtubeVideoId}`, {
				method: 'PUT',
				body: JSON.stringify({
					title: editedTitle,
					description: fullDescription,
				}),
			});

			setSuccessMessage('YouTube video updated successfully!');
			setTimeout(() => setSuccessMessage(''), 3000);
			onUpdate?.();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Failed to update YouTube video'
			);
		} finally {
			setUpdatingYouTube(false);
		}
	};

	// Add hashtag
	const addHashtag = () => {
		const tag = newHashtag.trim();
		if (
			tag &&
			!editedHashtags.includes(tag.startsWith('#') ? tag : `#${tag}`)
		) {
			const formattedTag = tag.startsWith('#') ? tag : `#${tag}`;
			setEditedHashtags([...editedHashtags, formattedTag]);
			setNewHashtag('');
		}
	};

	// Remove hashtag
	const removeHashtag = (index: number) => {
		setEditedHashtags(editedHashtags.filter((_, i) => i !== index));
	};

	// Loading state - checking for existing research
	if (checkingExisting) {
		return (
			<div className='text-center py-12 space-y-4'>
				<Loader2 className='w-8 h-8 mx-auto text-coral animate-spin' />
				<p className='text-gray-500 dark:text-gray-400'>
					Checking for existing research...
				</p>
			</div>
		);
	}

	// Initial state - no research started
	if (!taskId && !task) {
		return (
			<div className='space-y-6'>
				<div className='text-center py-8 space-y-4'>
					<div className='w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-coral/20 to-purple-500/20 flex items-center justify-center'>
						<Sparkles className='w-10 h-10 text-coral' />
					</div>
					<div>
						<h3 className='text-xl font-bold text-gray-900 dark:text-white'>
							AI Deep Research
						</h3>
						<p className='text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto'>
							Analyze {frames.length} extracted frames to generate optimized
							title, description, hashtags, and thumbnail prompt for maximum
							engagement.
						</p>
					</div>

					{frames.length === 0 && (
						<div className='bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-xl text-sm'>
							⚠️ No frames with AI descriptions found. Extract frames with "AI
							Analysis" enabled for better results.
						</div>
					)}

					<button
						onClick={startResearch}
						className='inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-coral to-purple-500 hover:from-coral-light hover:to-purple-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-coral/20'
					>
						<Sparkles size={20} />
						Start Deep Research
					</button>
				</div>

				{error && (
					<div className='bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm'>
						{error}
					</div>
				)}
			</div>
		);
	}

	// Research in progress
	if (
		task?.status === 'pending' ||
		task?.status === 'in_progress' ||
		(taskId && !task)
	) {
		return (
			<div className='text-center py-16 space-y-6'>
				<div className='relative w-24 h-24 mx-auto'>
					<div
						className='absolute inset-0 rounded-full bg-gradient-to-r from-coral to-purple-500 animate-spin'
						style={{ animationDuration: '3s' }}
					/>
					<div className='absolute inset-1 rounded-full bg-white dark:bg-dark-card flex items-center justify-center'>
						<Sparkles className='w-10 h-10 text-coral animate-pulse' />
					</div>
				</div>
				<div>
					<h3 className='text-xl font-bold text-gray-900 dark:text-white'>
						Deep Research in Progress
					</h3>
					<p className='text-gray-500 dark:text-gray-400 mt-2'>
						Analyzing video frames and generating optimized content...
					</p>
					<p className='text-xs text-gray-400 dark:text-gray-500 mt-4'>
						This may take 2-5 minutes
					</p>
				</div>
				<button
					onClick={cancelResearch}
					disabled={cancelling}
					className='inline-flex items-center gap-2 px-6 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 rounded-xl font-medium transition-all disabled:opacity-50'
				>
					{cancelling ? (
						<>
							<Loader2 size={16} className='animate-spin' />
							Cancelling...
						</>
					) : (
						'Cancel Research'
					)}
				</button>
			</div>
		);
	}

	// Research completed
	if (task?.status === 'completed' && task.result) {
		// Check if we have structured data
		const hasStructuredData = editedTitle || editedDescription;

		return (
			<div className='space-y-6'>
				{/* Success Header */}
				<div className='flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl'>
					<div className='w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center'>
						<Check className='w-5 h-5 text-green-500' />
					</div>
					<div className='flex-1'>
						<h4 className='font-semibold text-green-600 dark:text-green-400'>
							Research Complete!
						</h4>
						{task.result.theme && task.result.theme !== 'other' && (
							<p className='text-sm text-green-600/70 dark:text-green-400/70'>
								Theme detected:{' '}
								<span className='font-medium capitalize'>
									{task.result.theme}
								</span>
							</p>
						)}
					</div>
					<button
						onClick={startResearch}
						className='p-2 text-green-600 hover:bg-green-500/10 rounded-lg transition-colors'
						title='Re-run research'
					>
						<RefreshCw size={18} />
					</button>
				</div>

				{error && (
					<div className='bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm'>
						{error}
					</div>
				)}

				{successMessage && (
					<div className='bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl text-sm flex items-center gap-2'>
						<Check size={16} />
						{successMessage}
					</div>
				)}

				{/* Extracting state - when auto-extraction is in progress */}
				{extracting && (
					<div className='text-center py-8 space-y-4'>
						<div className='relative w-16 h-16 mx-auto'>
							<div
								className='absolute inset-0 rounded-full bg-gradient-to-r from-coral to-purple-500 animate-spin'
								style={{ animationDuration: '2s' }}
							/>
							<div className='absolute inset-1 rounded-full bg-white dark:bg-dark-card flex items-center justify-center'>
								<Sparkles className='w-6 h-6 text-coral' />
							</div>
						</div>
						<div>
							<h4 className='font-semibold text-gray-900 dark:text-white'>
								Extracting Structured Data...
							</h4>
							<p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
								AI is analyzing the research to generate title, description, and
								hashtags
							</p>
						</div>
					</div>
				)}

				{/* Extraction failed state - show retry option and allow manual entry */}
				{!extracting && extractionFailed && !hasStructuredData && (
					<div className='space-y-4'>
						<div className='p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl'>
							<div className='flex items-start gap-3'>
								<div className='w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0'>
									<Sparkles className='w-4 h-4 text-amber-500' />
								</div>
								<div className='flex-1'>
									<h4 className='font-medium text-amber-700 dark:text-amber-400'>
										Auto-extraction couldn't complete
									</h4>
									<p className='text-sm text-amber-600/80 dark:text-amber-400/80 mt-1'>
										You can retry the extraction or manually enter the details
										below.
									</p>
								</div>
								<button
									onClick={retryExtraction}
									className='px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2'
								>
									<RefreshCw size={14} />
									Retry
								</button>
							</div>
						</div>

						{/* Show raw research in expandable viewer */}
						{task.result.researchInsights && (
							<MarkdownViewer
								content={task.result.researchInsights}
								title='Raw Research Results'
								defaultExpanded={true}
							/>
						)}

						{/* Manual entry fields */}
						<div className='border-t border-gray-200 dark:border-dark-border pt-4 space-y-4'>
							<h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
								Or enter details manually:
							</h4>

							{/* Title */}
							<div className='space-y-2'>
								<label className='flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
									<Type size={16} className='text-coral' />
									Title
								</label>
								<input
									type='text'
									value={editedTitle}
									onChange={(e) => setEditedTitle(e.target.value)}
									placeholder='Enter video title...'
									className='w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-coral/50 focus:border-coral/50 outline-none transition-all'
									maxLength={100}
								/>
							</div>

							{/* Description */}
							<div className='space-y-2'>
								<label className='flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
									<FileText size={16} className='text-coral' />
									Description
								</label>
								<textarea
									value={editedDescription}
									onChange={(e) => setEditedDescription(e.target.value)}
									placeholder='Enter video description...'
									rows={6}
									className='w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-coral/50 focus:border-coral/50 outline-none transition-all resize-none text-sm'
								/>
							</div>

							{/* Hashtags */}
							<div className='space-y-2'>
								<label className='flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
									<Hash size={16} className='text-coral' />
									Hashtags
								</label>
								<div className='flex flex-wrap gap-2'>
									{editedHashtags.map((tag, i) => (
										<span
											key={i}
											className='inline-flex items-center gap-1 px-3 py-1.5 bg-coral/10 text-coral rounded-full text-sm font-medium group'
										>
											{tag}
											<button
												onClick={() => removeHashtag(i)}
												className='ml-1 hover:text-red-500 opacity-60 group-hover:opacity-100 transition-opacity'
											>
												<X size={14} />
											</button>
										</span>
									))}
								</div>
								<div className='flex gap-2'>
									<input
										type='text'
										value={newHashtag}
										onChange={(e) => setNewHashtag(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && addHashtag()}
										placeholder='Add hashtag...'
										className='flex-1 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-coral/50 focus:border-coral/50 outline-none transition-all'
									/>
									<button
										onClick={addHashtag}
										disabled={!newHashtag.trim()}
										className='px-4 py-2 bg-coral/10 hover:bg-coral/20 text-coral rounded-lg text-sm font-medium transition-all disabled:opacity-50'
									>
										Add
									</button>
								</div>
							</div>

							{/* YouTube update button */}
							{youtubeVideoId && (editedTitle || editedDescription) && (
								<button
									onClick={updateYouTube}
									disabled={updatingYouTube}
									className='w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
								>
									{updatingYouTube ? (
										<>
											<Loader2 size={18} className='animate-spin' />
											Updating YouTube...
										</>
									) : (
										<>
											<Save size={18} />
											Update YouTube Video
										</>
									)}
								</button>
							)}
						</div>
					</div>
				)}

				{/* Structured data fields - show when we have structured data */}
				{!extracting && hasStructuredData && (
					<>
						{/* Title */}
						<div className='space-y-2'>
							<div className='flex items-center justify-between'>
								<label className='flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
									<Type size={16} className='text-coral' />
									Title
								</label>
								<button
									onClick={() => copyToClipboard(editedTitle, 'title')}
									className='text-xs text-gray-400 hover:text-coral flex items-center gap-1'
								>
									{copiedField === 'title' ? (
										<Check size={12} />
									) : (
										<Copy size={12} />
									)}
									{copiedField === 'title' ? 'Copied!' : 'Copy'}
								</button>
							</div>
							<input
								type='text'
								value={editedTitle}
								onChange={(e) => setEditedTitle(e.target.value)}
								className='w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-coral/50 focus:border-coral/50 outline-none transition-all'
								maxLength={100}
							/>
							<p className='text-xs text-gray-400'>
								{editedTitle.length}/100 characters
							</p>
						</div>

						{/* Description */}
						<div className='space-y-2'>
							<div className='flex items-center justify-between'>
								<label className='flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
									<FileText size={16} className='text-coral' />
									Description
								</label>
								<button
									onClick={() =>
										copyToClipboard(editedDescription, 'description')
									}
									className='text-xs text-gray-400 hover:text-coral flex items-center gap-1'
								>
									{copiedField === 'description' ? (
										<Check size={12} />
									) : (
										<Copy size={12} />
									)}
									{copiedField === 'description' ? 'Copied!' : 'Copy'}
								</button>
							</div>
							<textarea
								value={editedDescription}
								onChange={(e) => setEditedDescription(e.target.value)}
								rows={8}
								className='w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-coral/50 focus:border-coral/50 outline-none transition-all resize-none text-sm'
							/>
						</div>

						{/* Hashtags */}
						<div className='space-y-2'>
							<label className='flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
								<Hash size={16} className='text-coral' />
								Hashtags
							</label>
							<div className='flex flex-wrap gap-2'>
								{editedHashtags.map((tag, i) => (
									<span
										key={i}
										className='inline-flex items-center gap-1 px-3 py-1.5 bg-coral/10 text-coral rounded-full text-sm font-medium group'
									>
										{tag}
										<button
											onClick={() => removeHashtag(i)}
											className='ml-1 hover:text-red-500 opacity-60 group-hover:opacity-100 transition-opacity'
											title='Remove hashtag'
										>
											<X size={14} />
										</button>
									</span>
								))}
							</div>
							<div className='flex gap-2'>
								<input
									type='text'
									value={newHashtag}
									onChange={(e) => setNewHashtag(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && addHashtag()}
									placeholder='Add hashtag...'
									className='flex-1 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-coral/50 focus:border-coral/50 outline-none transition-all'
								/>
								<button
									onClick={addHashtag}
									disabled={!newHashtag.trim()}
									className='px-4 py-2 bg-coral/10 hover:bg-coral/20 text-coral rounded-lg text-sm font-medium transition-all disabled:opacity-50'
								>
									Add
								</button>
							</div>
							{editedHashtags.length > 0 && (
								<button
									onClick={() =>
										copyToClipboard(editedHashtags.join(' '), 'all-hashtags')
									}
									className='text-xs text-gray-400 hover:text-coral flex items-center gap-1'
								>
									{copiedField === 'all-hashtags' ? (
										<Check size={12} />
									) : (
										<Copy size={12} />
									)}
									Copy all hashtags
								</button>
							)}
						</div>

						{/* Raw Research - Expandable MarkdownViewer */}
						{task.result.researchInsights && (
							<MarkdownViewer
								content={task.result.researchInsights}
								title='Raw Research Results'
								defaultExpanded={false}
							/>
						)}

						{/* Save to YouTube Button */}
						{youtubeVideoId && (
							<button
								onClick={updateYouTube}
								disabled={updatingYouTube || !editedTitle}
								className='w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
							>
								{updatingYouTube ? (
									<>
										<Loader2 size={18} className='animate-spin' />
										Updating YouTube...
									</>
								) : (
									<>
										<Save size={18} />
										Update YouTube Video
									</>
								)}
							</button>
						)}
					</>
				)}

				{/* Thumbnail Generation Section - always show if we have a prompt */}
				{(thumbnailPrompt || hasStructuredData) && !extracting && (
					<div className='border-t border-gray-200 dark:border-dark-border pt-6 space-y-4'>
						<h4 className='flex items-center gap-2 font-semibold text-gray-900 dark:text-white'>
							<Palette size={18} className='text-coral' />
							Thumbnail Generation
						</h4>

						<div className='space-y-2'>
							<label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
								Thumbnail Prompt
							</label>
							<textarea
								value={thumbnailPrompt}
								onChange={(e) => setThumbnailPrompt(e.target.value)}
								rows={3}
								className='w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-coral/50 focus:border-coral/50 outline-none transition-all resize-none text-sm'
								placeholder='Describe the thumbnail you want to generate...'
							/>
						</div>

						<button
							onClick={generateThumbnail}
							disabled={generatingThumbnail || !thumbnailPrompt}
							className='w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
						>
							{generatingThumbnail ? (
								<>
									<Loader2 size={18} className='animate-spin' />
									Generating Thumbnail...
								</>
							) : thumbnailImageUrl ? (
								<>
									<RefreshCw size={18} />
									Regenerate Thumbnail
								</>
							) : (
								<>
									<Image size={18} />
									Generate Thumbnail
								</>
							)}
						</button>

						{/* Thumbnail Error */}
						{thumbnailError && (
							<div className='p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-500'>
								{thumbnailError}
							</div>
						)}

						{/* Generated Thumbnail Display */}
						{thumbnailImageUrl && (
							<div className='space-y-3'>
								<div className='relative rounded-xl overflow-hidden border border-purple-200 dark:border-purple-500/30 shadow-lg'>
									<img
										src={thumbnailImageUrl}
										alt='Generated Thumbnail'
										className='w-full h-auto object-cover'
									/>
									{/* Overlay with actions */}
									<div className='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center pb-4 gap-2'>
										<button
											onClick={downloadThumbnail}
											className='flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white text-gray-800 rounded-lg font-medium text-sm shadow-lg transition-all'
										>
											<Download size={16} />
											Download
										</button>
										<button
											onClick={openThumbnailFullSize}
											className='flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white text-gray-800 rounded-lg font-medium text-sm shadow-lg transition-all'
										>
											<ExternalLink size={16} />
											Open Full Size
										</button>
									</div>
								</div>

								{/* Action buttons below image */}
								<div className='flex gap-2'>
									<button
										onClick={downloadThumbnail}
										className='flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-500/20 hover:bg-purple-200 dark:hover:bg-purple-500/30 text-purple-700 dark:text-purple-300 rounded-lg font-medium text-sm transition-all'
									>
										<Download size={16} />
										Download PNG
									</button>
									<button
										onClick={generateThumbnail}
										disabled={generatingThumbnail}
										className='flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm transition-all disabled:opacity-50'
									>
										<RefreshCw
											size={16}
											className={generatingThumbnail ? 'animate-spin' : ''}
										/>
										Regenerate
									</button>
								</div>

								<p className='text-xs text-gray-500 dark:text-gray-400 text-center'>
									💡 Tip: Download and add text overlays using Canva or
									Photoshop for best results
								</p>
							</div>
						)}
					</div>
				)}
			</div>
		);
	}

	// Research failed
	if (task?.status === 'failed') {
		return (
			<div className='text-center py-12 space-y-4'>
				<div className='w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center'>
					<Sparkles className='w-8 h-8 text-red-500' />
				</div>
				<div>
					<h3 className='text-lg font-bold text-gray-900 dark:text-white'>
						Research Failed
					</h3>
					<p className='text-red-500 mt-2'>
						{task.error || 'An unknown error occurred'}
					</p>
				</div>
				<button
					onClick={startResearch}
					className='inline-flex items-center gap-2 px-6 py-2 bg-coral hover:bg-coral-light text-white rounded-xl font-medium transition-all'
				>
					<RefreshCw size={16} />
					Try Again
				</button>
			</div>
		);
	}

	return null;
}
