import React, { useState } from 'react';
import { X, Save, Loader2, Sparkles } from 'lucide-react';
import { fetchWithAuth } from '../api';

interface Video {
	id: string;
	youtubeVideoId?: string;
	youtubeTitle?: string;
	youtubeDesc?: string;
}

interface Props {
	video: Video;
	onClose: () => void;
	onSave: () => void;
}

export default function VideoEditorModal({ video, onClose, onSave }: Props) {
	const [title, setTitle] = useState(video.youtubeTitle || '');
	const [description, setDescription] = useState(video.youtubeDesc || '');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!video.youtubeVideoId) return;

		setSaving(true);
		setError('');

		try {
			await fetchWithAuth(`/videos/${video.youtubeVideoId}`, {
				method: 'PUT',
				body: JSON.stringify({ title, description }),
			});
			onSave();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unknown error');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className='fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
			<div className='bg-dark-card border border-dark-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden'>
				<div className='p-6 border-b border-dark-border flex justify-between items-center bg-dark-bg/50'>
					<div className='flex items-center gap-3'>
						<div className='w-8 h-8 rounded-lg bg-coral/10 flex items-center justify-center'>
							<Sparkles className='w-4 h-4 text-coral' />
						</div>
						<h3 className='text-lg font-bold text-white'>
							Edit Content Details
						</h3>
					</div>
					<button
						onClick={onClose}
						className='text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg'
					>
						<X size={20} />
					</button>
				</div>

				<form
					onSubmit={handleSave}
					className='p-6 overflow-y-auto flex-1 space-y-6'
				>
					{error && (
						<div className='bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm'>
							{error}
						</div>
					)}

					<div className='space-y-2'>
						<label className='block text-xs font-medium text-gray-400 uppercase tracking-wider'>
							Title
						</label>
						<input
							type='text'
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							className='w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-coral/50 focus:border-coral/50 outline-none transition-all placeholder:text-gray-600'
							placeholder='Enter video title...'
							required
						/>
					</div>

					<div className='space-y-2'>
						<label className='block text-xs font-medium text-gray-400 uppercase tracking-wider'>
							Description
						</label>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={10}
							className='w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-coral/50 focus:border-coral/50 outline-none font-mono text-sm transition-all placeholder:text-gray-600 resize-none'
							placeholder='Enter video description...'
							required
						/>
					</div>
				</form>

				<div className='p-6 border-t border-dark-border bg-dark-bg/50 flex justify-end gap-3'>
					<button
						type='button'
						onClick={onClose}
						className='px-4 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all font-medium text-sm'
					>
						Cancel
					</button>
					<button
						onClick={handleSave}
						disabled={saving}
						className='px-6 py-2.5 bg-coral hover:bg-coral-light text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-coral/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
					>
						{saving ? (
							<>
								<Loader2 size={16} className='animate-spin' />
								<span>Saving...</span>
							</>
						) : (
							<>
								<Save size={16} />
								<span>Save Changes</span>
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
