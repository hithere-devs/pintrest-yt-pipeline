import React, { useEffect, useState } from 'react';
import {
	Trash2,
	Plus,
	ExternalLink,
	Video,
	GripVertical,
	Loader2,
} from 'lucide-react';
import { fetchWithAuth } from '../api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
}

interface DashboardData {
	queue: Video[];
}

export default function QueuePage() {
	const [data, setData] = useState<DashboardData | null>(null);
	const [newUrl, setNewUrl] = useState('');
	const [adding, setAdding] = useState(false);

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
	}, []);

	const addUrl = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newUrl) return;
		setAdding(true);
		try {
			await fetchWithAuth('/queue/add', {
				method: 'POST',
				body: JSON.stringify({ url: newUrl }),
			});
			setNewUrl('');
			fetchData();
		} catch (err) {
			console.error(err);
			alert('Failed to add URL');
		} finally {
			setAdding(false);
		}
	};

	const removeUrl = async (videoId: string) => {
		if (!confirm('Are you sure you want to remove this video?')) return;
		try {
			await fetchWithAuth(`/queue/${videoId}`, { method: 'DELETE' });
			fetchData();
		} catch (err) {
			console.error(err);
			alert('Failed to remove video');
		}
	};

	if (!data)
		return (
			<div className='flex items-center justify-center h-full'>
				<div className='flex flex-col items-center gap-4'>
					<div className='w-12 h-12 border-4 border-coral border-t-transparent rounded-full animate-spin' />
					<p className='text-gray-500 dark:text-gray-400'>Loading queue...</p>
				</div>
			</div>
		);

	return (
		<div className='space-y-6'>
			{/* Header */}
			<div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
				<div>
					<h2 className='text-2xl font-bold text-gray-900 dark:text-white'>
						Download Queue
					</h2>
					<p className='text-gray-500 dark:text-gray-400 text-sm mt-1'>
						Add Pinterest URLs to process and upload to YouTube
					</p>
				</div>
				<div className='flex items-center gap-2 text-sm'>
					<span className='text-gray-500 dark:text-gray-400'>Total:</span>
					<span className='font-bold text-coral'>
						{data.queue.length} videos
					</span>
				</div>
			</div>

			{/* Add URL Card */}
			<Card>
				<CardHeader>
					<CardTitle className='flex items-center gap-2'>
						<Plus className='text-coral' size={20} />
						Add New Video
					</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={addUrl} className='flex flex-col sm:flex-row gap-3'>
						<div className='flex-1'>
							<Input
								type='text'
								value={newUrl}
								onChange={(e) => setNewUrl(e.target.value)}
								placeholder='Paste Pinterest URL here...'
								className='h-12'
							/>
						</div>
						<Button
							type='submit'
							disabled={adding || !newUrl}
							className='h-12 px-6 bg-coral hover:bg-coral-dark text-white gap-2'
						>
							{adding ? (
								<>
									<Loader2 size={18} className='animate-spin' />
									Adding...
								</>
							) : (
								<>
									<Plus size={18} />
									Add to Queue
								</>
							)}
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Queue List */}
			<Card>
				<CardHeader>
					<CardTitle>Queue Items</CardTitle>
				</CardHeader>
				<CardContent>
					{data.queue.length === 0 ? (
						<div className='text-center py-16'>
							<div className='w-20 h-20 bg-gray-100 dark:bg-dark-hover rounded-full flex items-center justify-center mx-auto mb-4'>
								<Video className='text-gray-400' size={36} />
							</div>
							<h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-2'>
								Queue is Empty
							</h3>
							<p className='text-gray-500 dark:text-gray-400 max-w-sm mx-auto'>
								Add a Pinterest URL above to get started. Videos will be
								processed and uploaded automatically.
							</p>
						</div>
					) : (
						<div className='space-y-2'>
							{data.queue.map((video, i) => (
								<div
									key={video.id}
									className='flex items-center gap-4 p-4 bg-cream-dark dark:bg-dark-hover rounded-xl group hover:bg-coral/5 dark:hover:bg-coral/10 transition-all'
								>
									<div className='text-gray-300 dark:text-gray-600 cursor-grab'>
										<GripVertical size={20} />
									</div>
									<div className='w-10 h-10 bg-coral/10 rounded-xl flex items-center justify-center text-coral font-bold text-sm shrink-0'>
										{i + 1}
									</div>
									<div className='flex-1 min-w-0'>
										<a
											href={video.pinterestUrl}
											target='_blank'
											rel='noreferrer'
											className='font-medium text-gray-900 dark:text-white hover:text-coral dark:hover:text-coral truncate block text-sm'
										>
											{video.pinterestUrl}
										</a>
										<div className='flex items-center gap-2 mt-1'>
											<span className='text-xs text-coral bg-coral/10 px-2 py-0.5 rounded-full'>
												{video.status}
											</span>
											<a
												href={video.pinterestUrl}
												target='_blank'
												rel='noreferrer'
												className='text-xs text-gray-400 hover:text-coral flex items-center gap-1'
											>
												<ExternalLink size={12} />
												Open
											</a>
										</div>
									</div>
									<Button
										variant='ghost'
										size='icon'
										onClick={() => removeUrl(video.id)}
										className='text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all'
									>
										<Trash2 size={18} />
									</Button>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
