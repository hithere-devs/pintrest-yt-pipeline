import { useState, useRef } from 'react';
import { Play, Loader2, Settings, RefreshCw } from 'lucide-react';
import { fetchWithAuth } from '../api';

/**
 * Simple Caption Test Page
 *
 * This page just triggers video generation - all styling parameters are
 * HARDCODED in src/index.ts in the /test/caption-preview endpoint.
 *
 * To experiment with caption styles:
 * 1. Edit the hardcoded values in src/index.ts (search for "HARDCODED TEST VALUES")
 * 2. Save the file (server will auto-reload)
 * 3. Click "Generate Test Video" button
 * 4. Watch the result
 * 5. Repeat until you find the right values
 */
export default function CaptionTestPage() {
	const [generating, setGenerating] = useState(false);
	const [videoUrl, setVideoUrl] = useState<string | null>(null);
	const [error, setError] = useState('');
	const videoRef = useRef<HTMLVideoElement>(null);

	const generateTestVideo = async () => {
		setGenerating(true);
		setError('');
		setVideoUrl(null);

		try {
			const res = await fetchWithAuth('/test/caption-preview', {
				method: 'POST',
				body: JSON.stringify({}), // No params needed - all hardcoded in backend
			});

			if (res.videoUrl) {
				setVideoUrl(res.videoUrl);
			} else {
				setError('No video URL returned');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to generate');
		} finally {
			setGenerating(false);
		}
	};

	return (
		<div className='min-h-screen bg-gray-50 dark:bg-dark-bg p-6'>
			<div className='max-w-2xl mx-auto'>
				{/* Header */}
				<div className='mb-6'>
					<h1 className='text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
						<Settings className='w-6 h-6 text-coral' />
						Caption Testing Lab
					</h1>
					<p className='text-gray-500 dark:text-gray-400 mt-2'>
						Quick test for caption styling. All parameters are hardcoded in the
						backend.
					</p>
				</div>

				{/* Instructions */}
				<div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6'>
					<h3 className='font-semibold text-blue-800 dark:text-blue-300 mb-2'>
						How to test:
					</h3>
					<ol className='text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside'>
						<li>
							Edit hardcoded values in{' '}
							<code className='bg-blue-100 dark:bg-blue-800 px-1 rounded'>
								src/index.ts
							</code>
						</li>
						<li>
							Search for{' '}
							<code className='bg-blue-100 dark:bg-blue-800 px-1 rounded'>
								HARDCODED TEST VALUES
							</code>
						</li>
						<li>Save file (server auto-reloads)</li>
						<li>Click generate button below</li>
						<li>Watch result, repeat until happy</li>
					</ol>
				</div>

				{/* Current Values Display */}
				<div className='bg-gray-900 rounded-xl p-4 mb-6 font-mono text-xs text-green-400'>
					<p className='text-gray-500 mb-2'>
						// Current hardcoded values (edit in src/index.ts):
					</p>
					<pre className='whitespace-pre-wrap'>
						{`FONTSIZE = 24
FONTNAME = 'Arial'
PRIMARY_COLOUR = '&H00FFFFFF'  // White
OUTLINE_COLOUR = '&H00000000'  // Black
OUTLINE = 2
ALIGNMENT = 2  // bottom-center
MARGIN_V = 100
MARGIN_L = 20
MARGIN_R = 20`}
					</pre>
				</div>

				{error && (
					<div className='mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400'>
						{error}
					</div>
				)}

				{/* Generate Button */}
				<button
					onClick={generateTestVideo}
					disabled={generating}
					className='w-full py-4 bg-coral hover:bg-coral/90 disabled:bg-gray-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all mb-6'
				>
					{generating ? (
						<>
							<Loader2 className='w-5 h-5 animate-spin' />
							Generating Test Video...
						</>
					) : (
						<>
							<Play className='w-5 h-5' />
							Generate Test Video (6 seconds)
						</>
					)}
				</button>

				{/* Video Result */}
				{videoUrl && (
					<div className='bg-white dark:bg-dark-card rounded-xl p-6 border border-gray-200 dark:border-gray-800'>
						<div className='flex items-center justify-between mb-4'>
							<h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
								Result
							</h3>
							<button
								onClick={generateTestVideo}
								disabled={generating}
								className='text-coral hover:text-coral/80 flex items-center gap-1 text-sm'
							>
								<RefreshCw className='w-4 h-4' />
								Regenerate
							</button>
						</div>

						<div className='aspect-[9/16] max-w-[300px] mx-auto bg-black rounded-lg overflow-hidden'>
							<video
								ref={videoRef}
								src={videoUrl}
								controls
								autoPlay
								loop
								className='w-full h-full object-contain'
							/>
						</div>

						<p className='text-center text-sm text-gray-500 dark:text-gray-400 mt-3'>
							Check the terminal for style params used
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
