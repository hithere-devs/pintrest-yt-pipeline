import { useState, useEffect, useRef } from 'react';
import {
	Video,
	Music,
	Mic2,
	Type,
	Play,
	Calendar,
	ChevronRight,
	ChevronLeft,
	Sparkles,
	Loader2,
	Check,
	RefreshCw,
	Download,
	Wand2,
	Volume2,
	X,
	Pause,
	Volume1,
	VolumeX,
	Shuffle,
} from 'lucide-react';
import { fetchWithAuth } from '../api';

// Types
interface Asset {
	id: string;
	type: 'video' | 'music' | 'voice';
	name: string;
	description?: string;
	s3Url: string;
	thumbnailUrl?: string;
	duration?: number;
	tags?: string[];
}

interface Voice {
	id: string;
	name: string;
	description: string;
	preview?: string;
}

interface ScriptLine {
	speaker: string;
	text: string;
	emotion?: string;
}

interface GeneratedScript {
	script: string;
	lines: ScriptLine[];
	estimatedDuration: number;
	suggestedMusic: string;
	hookLine: string;
	callToAction: string;
}

interface CaptionSettings {
	font: string;
	fontSize: number;
	fontColor: string;
	strokeColor: string;
	strokeWidth: number;
	position: 'top' | 'center' | 'bottom';
	animation: 'none' | 'fade' | 'slide' | 'bounce';
}

interface Project {
	id: string;
	status: string;
	name?: string;
	backgroundVideoId?: string;
	musicId?: string;
	voiceId?: string;
	scriptContent?: string;
	captionSettings: CaptionSettings;
	finalVideoS3Url?: string;
}

// Steps
const STEPS = [
	{
		id: 1,
		name: 'Background',
		icon: Video,
		description: 'Select background video',
	},
	{ id: 2, name: 'Script', icon: Sparkles, description: 'Generate AI script' },
	{ id: 3, name: 'Voice', icon: Mic2, description: 'Choose voice & generate' },
	{ id: 4, name: 'Music', icon: Music, description: 'Select background music' },
	{ id: 5, name: 'Style', icon: Type, description: 'Customize captions' },
	{ id: 6, name: 'Preview', icon: Play, description: 'Review & generate' },
	{ id: 7, name: 'Schedule', icon: Calendar, description: 'Schedule uploads' },
];

const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
	font: 'Montserrat',
	fontSize: 32, // Smaller default for short-form videos
	fontColor: '#FFFFFF',
	strokeColor: '#000000',
	strokeWidth: 2,
	position: 'center', // Centered for better visibility
	animation: 'fade',
};

export default function ViralVideoGeneratorPage() {
	const [currentStep, setCurrentStep] = useState(1);
	const [project, setProject] = useState<Project | null>(null);
	const [error, setError] = useState('');

	// Video preview modal
	const [previewVideo, setPreviewVideo] = useState<Asset | null>(null);
	const [previewPlaying, setPreviewPlaying] = useState(false);
	const [previewMuted, setPreviewMuted] = useState(true);
	const previewVideoRef = useRef<HTMLVideoElement>(null);

	// Step 1: Background videos
	const [backgroundVideos, setBackgroundVideos] = useState<Asset[]>([]);
	const [selectedBackground, setSelectedBackground] = useState<Asset | null>(
		null
	);

	// Step 2: Script
	const [topic, setTopic] = useState('');
	const [scriptFormat, setScriptFormat] = useState<
		'monologue' | 'dialogue' | 'narration'
	>('monologue');
	const [voiceStyle, setVoiceStyle] = useState('energetic');
	const [platform, setPlatform] = useState('youtube_shorts');
	const [generatedScript, setGeneratedScript] =
		useState<GeneratedScript | null>(null);
	const [editedScript, setEditedScript] = useState('');
	const [generatingScript, setGeneratingScript] = useState(false);
	const [generatingIdea, setGeneratingIdea] = useState(false);

	// Step 3: Voice
	const [voices, setVoices] = useState<Voice[]>([]);
	const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
	const [generatingVoiceover, setGeneratingVoiceover] = useState(false);
	const [voiceoverGenerated, setVoiceoverGenerated] = useState(false);

	// Step 4: Music
	const [musicTracks, setMusicTracks] = useState<Asset[]>([]);
	const [selectedMusic, setSelectedMusic] = useState<Asset | null>(null);

	// Step 5: Caption settings
	const [captionSettings, setCaptionSettings] = useState<CaptionSettings>(
		DEFAULT_CAPTION_SETTINGS
	);

	// Step 6: Compositing
	const [compositing, setCompositing] = useState(false);
	const [finalVideoUrl, setFinalVideoUrl] = useState('');

	// Load initial data
	useEffect(() => {
		loadAssets();
		loadVoices();
	}, []);

	const loadAssets = async () => {
		try {
			const [videosRes, musicRes] = await Promise.all([
				fetchWithAuth('/assets/video'),
				fetchWithAuth('/assets/music'),
			]);
			setBackgroundVideos(videosRes.assets || []);
			setMusicTracks(musicRes.assets || []);
		} catch (err) {
			console.error('Failed to load assets:', err);
		}
	};

	const loadVoices = async () => {
		try {
			const res = await fetchWithAuth('/viral/voices');
			setVoices(res.voices || []);
		} catch (err) {
			console.error('Failed to load voices:', err);
		}
	};

	const createProject = async () => {
		try {
			const res = await fetchWithAuth('/viral/projects', {
				method: 'POST',
				body: JSON.stringify({
					name: topic || 'New Viral Video',
					backgroundVideoId: selectedBackground?.id,
					musicId: selectedMusic?.id,
				}),
			});
			setProject(res.project);
			return res.project;
		} catch (err) {
			throw new Error('Failed to create project');
		}
	};

	const generateScript = async () => {
		setGeneratingScript(true);
		setError('');
		try {
			let proj = project;
			if (!proj) {
				proj = await createProject();
			}

			if (!proj) {
				throw new Error('Failed to create project');
			}

			const res = await fetchWithAuth('/viral/generate-script', {
				method: 'POST',
				body: JSON.stringify({
					projectId: proj.id,
					topic,
					format: scriptFormat,
					duration: 60,
					voiceStyle,
					platform,
				}),
			});

			setGeneratedScript(res.script);
			setEditedScript(res.script.script);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Failed to generate script'
			);
		} finally {
			setGeneratingScript(false);
		}
	};

	const generateRandomIdea = async () => {
		setGeneratingIdea(true);
		setError('');
		try {
			const res = await fetchWithAuth('/viral/random-idea', {
				method: 'POST',
				body: JSON.stringify({}),
			});
			setTopic(res.idea);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to generate idea');
		} finally {
			setGeneratingIdea(false);
		}
	};

	const generateVoiceover = async () => {
		if (!project || !selectedVoice) return;

		setGeneratingVoiceover(true);
		setError('');
		try {
			await fetchWithAuth('/viral/generate-voiceover', {
				method: 'POST',
				body: JSON.stringify({
					projectId: project.id,
					script: editedScript,
					voiceId: selectedVoice.id,
				}),
			});
			setVoiceoverGenerated(true);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Failed to generate voiceover'
			);
		} finally {
			setGeneratingVoiceover(false);
		}
	};

	const updateProjectSettings = async () => {
		if (!project) return;

		try {
			await fetchWithAuth(`/viral/project/${project.id}`, {
				method: 'PUT',
				body: JSON.stringify({
					backgroundVideoId: selectedBackground?.id,
					musicId: selectedMusic?.id,
					captionSettings,
				}),
			});
		} catch (err) {
			console.error('Failed to update project:', err);
		}
	};

	const compositeVideo = async () => {
		if (!project) return;

		setCompositing(true);
		setError('');
		try {
			// Update project with latest settings
			await updateProjectSettings();

			const res = await fetchWithAuth('/viral/composite', {
				method: 'POST',
				body: JSON.stringify({ projectId: project.id }),
			});

			setFinalVideoUrl(res.video.s3Url);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Failed to composite video'
			);
		} finally {
			setCompositing(false);
		}
	};

	const nextStep = () => {
		if (currentStep < STEPS.length) {
			setCurrentStep(currentStep + 1);
		}
	};

	const prevStep = () => {
		if (currentStep > 1) {
			setCurrentStep(currentStep - 1);
		}
	};

	const canProceed = () => {
		switch (currentStep) {
			case 1:
				return selectedBackground !== null;
			case 2:
				return generatedScript !== null && editedScript.trim().length > 0;
			case 3:
				return selectedVoice !== null && voiceoverGenerated;
			case 4:
				return true; // Music is optional
			case 5:
				return true; // Caption settings have defaults
			case 6:
				return finalVideoUrl !== '';
			default:
				return true;
		}
	};

	return (
		<div className='min-h-screen bg-gray-50 dark:bg-dark-bg'>
			{/* Header */}
			<div className='bg-white dark:bg-dark-card border-b border-gray-200 dark:border-gray-800 px-6 py-4'>
				<div className='flex items-center justify-between'>
					<div>
						<h1 className='text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
							<Wand2 className='w-7 h-7 text-coral' />
							Viral Video Generator
						</h1>
						<p className='text-gray-500 dark:text-gray-400 mt-1'>
							Create engaging videos with AI-powered scripts and professional
							voiceovers
						</p>
					</div>
				</div>
			</div>

			{/* Progress Steps */}
			<div className='bg-white dark:bg-dark-card border-b border-gray-200 dark:border-gray-800 px-6 py-4'>
				<div className='flex items-center justify-between max-w-4xl mx-auto'>
					{STEPS.map((step, index) => {
						const Icon = step.icon;
						const isActive = currentStep === step.id;
						const isCompleted = currentStep > step.id;

						return (
							<div key={step.id} className='flex items-center'>
								<button
									onClick={() => setCurrentStep(step.id)}
									className={`flex flex-col items-center gap-1 transition-all ${
										isActive
											? 'text-coral'
											: isCompleted
											? 'text-green-500'
											: 'text-gray-400 dark:text-gray-600'
									}`}
								>
									<div
										className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
											isActive
												? 'bg-coral text-white'
												: isCompleted
												? 'bg-green-500 text-white'
												: 'bg-gray-200 dark:bg-gray-700'
										}`}
									>
										{isCompleted ? <Check size={20} /> : <Icon size={20} />}
									</div>
									<span className='text-xs font-medium hidden sm:block'>
										{step.name}
									</span>
								</button>
								{index < STEPS.length - 1 && (
									<div
										className={`w-8 sm:w-16 h-0.5 mx-2 ${
											isCompleted
												? 'bg-green-500'
												: 'bg-gray-200 dark:bg-gray-700'
										}`}
									/>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* Main Content */}
			<div className='max-w-6xl mx-auto px-6 py-8'>
				{error && (
					<div className='mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400'>
						{error}
					</div>
				)}

				{/* Step 1: Background Video Selection */}
				{currentStep === 1 && (
					<div className='space-y-6'>
						<div className='text-center mb-8'>
							<h2 className='text-xl font-semibold text-gray-900 dark:text-white'>
								Choose a Background Video
							</h2>
							<p className='text-gray-500 dark:text-gray-400 mt-2'>
								Select a satisfying or aesthetic video that will play behind
								your content
							</p>
						</div>

						{backgroundVideos.length === 0 ? (
							<div className='text-center py-12'>
								<Video className='w-16 h-16 mx-auto text-gray-400 mb-4' />
								<p className='text-gray-500 dark:text-gray-400'>
									No background videos available. Upload some in the asset
									library.
								</p>
							</div>
						) : (
							<div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'>
								{backgroundVideos.map((video) => (
									<div
										key={video.id}
										onClick={() => setSelectedBackground(video)}
										className={`group relative aspect-[9/16] rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
											selectedBackground?.id === video.id
												? 'border-coral ring-2 ring-coral/30'
												: 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
										}`}
									>
										{/* Video thumbnail with hover preview */}
										<video
											src={video.s3Url}
											className='w-full h-full object-cover'
											muted
											loop
											playsInline
											preload='metadata'
											onMouseEnter={(e) => {
												const vid = e.currentTarget;
												vid.currentTime = 0;
												vid.play().catch(() => {});
											}}
											onMouseLeave={(e) => {
												e.currentTarget.pause();
												e.currentTarget.currentTime = 0;
											}}
											poster={video.thumbnailUrl || undefined}
										/>

										{/* Gradient overlay */}
										<div className='absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none' />

										{/* Play button - click to open full preview */}
										<button
											onClick={(e) => {
												e.stopPropagation(); // Prevent card selection
												setPreviewVideo(video);
											}}
											className='absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'
										>
											<div className='w-12 h-12 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/40 hover:scale-110 transition-all'>
												<Play className='w-6 h-6 text-white ml-0.5' />
											</div>
										</button>

										{/* Video info */}
										<div className='absolute bottom-2 left-2 right-2 pointer-events-none'>
											<p className='text-white text-xs font-medium truncate'>
												{video.name}
											</p>
											{video.duration && (
												<p className='text-white/60 text-xs'>
													{Math.floor(video.duration / 60)}:
													{String(Math.floor(video.duration % 60)).padStart(
														2,
														'0'
													)}
												</p>
											)}
										</div>

										{/* Selected checkmark */}
										{selectedBackground?.id === video.id && (
											<div className='absolute top-2 right-2 w-6 h-6 bg-coral rounded-full flex items-center justify-center'>
												<Check className='w-4 h-4 text-white' />
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				)}

				{/* Step 2: Script Generation */}
				{currentStep === 2 && (
					<div className='space-y-6'>
						<div className='text-center mb-8'>
							<h2 className='text-xl font-semibold text-gray-900 dark:text-white'>
								Generate Your Script
							</h2>
							<p className='text-gray-500 dark:text-gray-400 mt-2'>
								Use AI to research and write an engaging script for your video
							</p>
						</div>

						<div className='grid md:grid-cols-2 gap-6'>
							{/* Input Section */}
							<div className='space-y-4'>
								<div>
									<div className='flex items-center justify-between mb-2'>
										<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
											Topic / Prompt
										</label>
										<button
											onClick={generateRandomIdea}
											disabled={generatingIdea}
											className='flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all disabled:opacity-50'
										>
											{generatingIdea ? (
												<>
													<Loader2 className='w-3.5 h-3.5 animate-spin' />
													Generating...
												</>
											) : (
												<>
													<Shuffle className='w-3.5 h-3.5' />
													Random Idea
												</>
											)}
										</button>
									</div>
									<textarea
										value={topic}
										onChange={(e) => setTopic(e.target.value)}
										placeholder='Enter your video topic or prompt... e.g., "5 shocking facts about the ocean" or "Why you should wake up at 5am"'
										className='w-full h-32 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-card text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-coral focus:border-transparent resize-none'
									/>
								</div>

								<div className='grid grid-cols-2 gap-4'>
									<div>
										<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
											Format
										</label>
										<select
											value={scriptFormat}
											onChange={(e) => setScriptFormat(e.target.value as any)}
											className='w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-card text-gray-900 dark:text-white'
										>
											<option value='monologue'>Monologue</option>
											<option value='dialogue'>Dialogue</option>
											<option value='narration'>Narration</option>
										</select>
									</div>
									<div>
										<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
											Voice Style
										</label>
										<select
											value={voiceStyle}
											onChange={(e) => setVoiceStyle(e.target.value)}
											className='w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-card text-gray-900 dark:text-white'
										>
											<option value='energetic'>Energetic</option>
											<option value='calm'>Calm</option>
											<option value='dramatic'>Dramatic</option>
											<option value='humorous'>Humorous</option>
											<option value='professional'>Professional</option>
										</select>
									</div>
								</div>

								<div>
									<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
										Platform
									</label>
									<select
										value={platform}
										onChange={(e) => setPlatform(e.target.value)}
										className='w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-card text-gray-900 dark:text-white'
									>
										<option value='youtube_shorts'>YouTube Shorts</option>
										<option value='youtube'>YouTube</option>
										<option value='tiktok'>TikTok</option>
										<option value='instagram_reels'>Instagram Reels</option>
									</select>
								</div>

								<button
									onClick={generateScript}
									disabled={!topic.trim() || generatingScript}
									className='w-full flex items-center justify-center gap-2 px-6 py-3 bg-coral hover:bg-coral-light text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed'
								>
									{generatingScript ? (
										<>
											<Loader2 className='w-5 h-5 animate-spin' />
											Generating Script...
										</>
									) : (
										<>
											<Sparkles className='w-5 h-5' />
											Generate Script
										</>
									)}
								</button>
							</div>

							{/* Output Section */}
							<div className='space-y-4'>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
									Generated Script
								</label>
								<textarea
									value={editedScript}
									onChange={(e) => setEditedScript(e.target.value)}
									placeholder='Your AI-generated script will appear here...'
									className='w-full h-64 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-card text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-coral focus:border-transparent resize-none font-mono text-sm'
								/>
								{generatedScript && (
									<div className='flex flex-wrap gap-2 text-sm'>
										<span className='px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full'>
											~{generatedScript.estimatedDuration}s
										</span>
										<span className='px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full'>
											{generatedScript.suggestedMusic}
										</span>
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Step 3: Voice Selection */}
				{currentStep === 3 && (
					<div className='space-y-6'>
						<div className='text-center mb-8'>
							<h2 className='text-xl font-semibold text-gray-900 dark:text-white'>
								Choose a Voice
							</h2>
							<p className='text-gray-500 dark:text-gray-400 mt-2'>
								Select a voice character for your video narration
							</p>
						</div>

						<div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-4'>
							{voices.map((voice) => (
								<button
									key={voice.id}
									onClick={() => setSelectedVoice(voice)}
									className={`p-4 rounded-xl border-2 text-left transition-all ${
										selectedVoice?.id === voice.id
											? 'border-coral bg-coral/5'
											: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
									}`}
								>
									<div className='flex items-start gap-3'>
										<div
											className={`w-12 h-12 rounded-full flex items-center justify-center ${
												selectedVoice?.id === voice.id
													? 'bg-coral text-white'
													: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
											}`}
										>
											<Mic2 size={24} />
										</div>
										<div className='flex-1'>
											<h3 className='font-semibold text-gray-900 dark:text-white'>
												{voice.name}
											</h3>
											<p className='text-sm text-gray-500 dark:text-gray-400'>
												{voice.description}
											</p>
										</div>
									</div>
									{selectedVoice?.id === voice.id && (
										<div className='mt-3 flex items-center gap-2 text-coral text-sm'>
											<Check size={16} />
											Selected
										</div>
									)}
								</button>
							))}
						</div>

						{selectedVoice && (
							<div className='flex justify-center mt-8'>
								<button
									onClick={generateVoiceover}
									disabled={generatingVoiceover || voiceoverGenerated}
									className='flex items-center gap-2 px-8 py-3 bg-coral hover:bg-coral-light text-white rounded-xl font-medium transition-all disabled:opacity-50'
								>
									{generatingVoiceover ? (
										<>
											<Loader2 className='w-5 h-5 animate-spin' />
											Generating Voiceover...
										</>
									) : voiceoverGenerated ? (
										<>
											<Check className='w-5 h-5' />
											Voiceover Generated
										</>
									) : (
										<>
											<Volume2 className='w-5 h-5' />
											Generate Voiceover
										</>
									)}
								</button>
							</div>
						)}
					</div>
				)}

				{/* Step 4: Music Selection */}
				{currentStep === 4 && (
					<div className='space-y-6'>
						<div className='text-center mb-8'>
							<h2 className='text-xl font-semibold text-gray-900 dark:text-white'>
								Add Background Music (Optional)
							</h2>
							<p className='text-gray-500 dark:text-gray-400 mt-2'>
								Select a track to play softly behind your voiceover
							</p>
						</div>

						{musicTracks.length === 0 ? (
							<div className='text-center py-12'>
								<Music className='w-16 h-16 mx-auto text-gray-400 mb-4' />
								<p className='text-gray-500 dark:text-gray-400'>
									No music tracks available. You can skip this step or upload
									music in the asset library.
								</p>
							</div>
						) : (
							<div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-4'>
								{musicTracks.map((track) => (
									<button
										key={track.id}
										onClick={() =>
											setSelectedMusic(
												selectedMusic?.id === track.id ? null : track
											)
										}
										className={`p-4 rounded-xl border-2 text-left transition-all ${
											selectedMusic?.id === track.id
												? 'border-coral bg-coral/5'
												: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
										}`}
									>
										<div className='flex items-center gap-3'>
											<div
												className={`w-12 h-12 rounded-xl flex items-center justify-center ${
													selectedMusic?.id === track.id
														? 'bg-coral text-white'
														: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
												}`}
											>
												<Music size={24} />
											</div>
											<div>
												<h3 className='font-semibold text-gray-900 dark:text-white'>
													{track.name}
												</h3>
												{track.duration && (
													<p className='text-sm text-gray-500'>
														{Math.floor(track.duration / 60)}:
														{String(Math.floor(track.duration % 60)).padStart(
															2,
															'0'
														)}
													</p>
												)}
											</div>
										</div>
									</button>
								))}
							</div>
						)}
					</div>
				)}

				{/* Step 5: Caption Settings */}
				{currentStep === 5 && (
					<div className='space-y-6'>
						<div className='text-center mb-8'>
							<h2 className='text-xl font-semibold text-gray-900 dark:text-white'>
								Customize Captions
							</h2>
							<p className='text-gray-500 dark:text-gray-400 mt-2'>
								Style the text that appears on your video
							</p>
						</div>

						<div className='max-w-2xl mx-auto space-y-6'>
							<div className='grid grid-cols-2 gap-4'>
								<div>
									<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
										Font
									</label>
									<select
										value={captionSettings.font}
										onChange={(e) =>
											setCaptionSettings({
												...captionSettings,
												font: e.target.value,
											})
										}
										className='w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-card text-gray-900 dark:text-white'
									>
										<option value='Montserrat'>Montserrat</option>
										<option value='Arial'>Arial</option>
										<option value='Impact'>Impact</option>
										<option value='Helvetica'>Helvetica</option>
									</select>
								</div>
								<div>
									<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
										Font Size
									</label>
									<input
										type='number'
										value={captionSettings.fontSize}
										onChange={(e) =>
											setCaptionSettings({
												...captionSettings,
												fontSize: Number(e.target.value),
											})
										}
										className='w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-card text-gray-900 dark:text-white'
									/>
								</div>
							</div>

							<div className='grid grid-cols-2 gap-4'>
								<div>
									<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
										Text Color
									</label>
									<div className='flex gap-2'>
										<input
											type='color'
											value={captionSettings.fontColor}
											onChange={(e) =>
												setCaptionSettings({
													...captionSettings,
													fontColor: e.target.value,
												})
											}
											className='w-12 h-10 rounded cursor-pointer'
										/>
										<input
											type='text'
											value={captionSettings.fontColor}
											onChange={(e) =>
												setCaptionSettings({
													...captionSettings,
													fontColor: e.target.value,
												})
											}
											className='flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-card text-gray-900 dark:text-white font-mono'
										/>
									</div>
								</div>
								<div>
									<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
										Stroke Color
									</label>
									<div className='flex gap-2'>
										<input
											type='color'
											value={captionSettings.strokeColor}
											onChange={(e) =>
												setCaptionSettings({
													...captionSettings,
													strokeColor: e.target.value,
												})
											}
											className='w-12 h-10 rounded cursor-pointer'
										/>
										<input
											type='text'
											value={captionSettings.strokeColor}
											onChange={(e) =>
												setCaptionSettings({
													...captionSettings,
													strokeColor: e.target.value,
												})
											}
											className='flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-card text-gray-900 dark:text-white font-mono'
										/>
									</div>
								</div>
							</div>

							<div className='grid grid-cols-2 gap-4'>
								<div>
									<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
										Position
									</label>
									<select
										value={captionSettings.position}
										onChange={(e) =>
											setCaptionSettings({
												...captionSettings,
												position: e.target.value as any,
											})
										}
										className='w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-card text-gray-900 dark:text-white'
									>
										<option value='top'>Top</option>
										<option value='center'>Center</option>
										<option value='bottom'>Bottom</option>
									</select>
								</div>
								<div>
									<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
										Animation
									</label>
									<select
										value={captionSettings.animation}
										onChange={(e) =>
											setCaptionSettings({
												...captionSettings,
												animation: e.target.value as any,
											})
										}
										className='w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-card text-gray-900 dark:text-white'
									>
										<option value='none'>None</option>
										<option value='fade'>Fade</option>
										<option value='slide'>Slide</option>
										<option value='bounce'>Bounce</option>
									</select>
								</div>
							</div>

							{/* Preview */}
							<div className='mt-8 p-6 bg-gray-900 rounded-xl aspect-video flex items-end justify-center pb-8'>
								<p
									style={{
										fontFamily: captionSettings.font,
										fontSize: `${Math.min(captionSettings.fontSize / 2, 32)}px`,
										color: captionSettings.fontColor,
										textShadow: `${captionSettings.strokeWidth}px ${captionSettings.strokeWidth}px 0 ${captionSettings.strokeColor}`,
									}}
									className='text-center'
								>
									Sample caption text preview
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Step 6: Preview & Generate */}
				{currentStep === 6 && (
					<div className='space-y-6'>
						<div className='text-center mb-8'>
							<h2 className='text-xl font-semibold text-gray-900 dark:text-white'>
								Preview & Generate
							</h2>
							<p className='text-gray-500 dark:text-gray-400 mt-2'>
								Review your selections and generate the final video
							</p>
						</div>

						<div className='max-w-4xl mx-auto'>
							{/* Live Preview - 9:16 Portrait */}
							<div className='mb-6'>
								<h3 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center'>
									Live Preview
								</h3>
								<div className='flex justify-center'>
									<div className='relative w-[270px] h-[480px] bg-black rounded-2xl overflow-hidden shadow-lg'>
										{selectedBackground ? (
											<video
												src={selectedBackground.s3Url}
												className='w-full h-full object-cover'
												autoPlay
												loop
												muted
												playsInline
											/>
										) : (
											<div className='w-full h-full flex items-center justify-center bg-gray-900'>
												<Video className='w-16 h-16 text-gray-600' />
											</div>
										)}

										{/* Caption preview overlay */}
										<div
											className={`absolute left-0 right-0 px-4 flex justify-center ${
												captionSettings.position === 'top'
													? 'top-8'
													: captionSettings.position === 'center'
													? 'top-1/2 -translate-y-1/2'
													: 'bottom-8'
											}`}
										>
											<p
												style={{
													fontFamily: captionSettings.font,
													fontSize: `${Math.min(
														captionSettings.fontSize * 0.4,
														24
													)}px`,
													color: captionSettings.fontColor,
													textShadow: `
														-${captionSettings.strokeWidth}px -${captionSettings.strokeWidth}px 0 ${captionSettings.strokeColor},
														${captionSettings.strokeWidth}px -${captionSettings.strokeWidth}px 0 ${captionSettings.strokeColor},
														-${captionSettings.strokeWidth}px ${captionSettings.strokeWidth}px 0 ${captionSettings.strokeColor},
														${captionSettings.strokeWidth}px ${captionSettings.strokeWidth}px 0 ${captionSettings.strokeColor}
													`,
												}}
												className='text-center font-bold max-w-[240px] animate-pulse'
											>
												{editedScript.split(' ').slice(0, 2).join(' ')}
											</p>
										</div>

										{/* Voiceover indicator */}
										{voiceoverGenerated && (
											<div className='absolute top-4 left-4 flex items-center gap-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full'>
												<Volume2 className='w-3 h-3 text-coral' />
												<span className='text-[10px] text-white'>
													Voiceover Ready
												</span>
											</div>
										)}

										{/* Music indicator */}
										{selectedMusic && (
											<div className='absolute top-4 right-4 flex items-center gap-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full'>
												<Music className='w-3 h-3 text-coral' />
												<span className='text-[10px] text-white truncate max-w-[60px]'>
													{selectedMusic.name}
												</span>
											</div>
										)}
									</div>
								</div>
							</div>

							{/* Summary Cards */}
							<div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-6'>
								<div className='p-4 bg-gray-100 dark:bg-gray-800 rounded-xl'>
									<div className='flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1'>
										<Video className='w-4 h-4' />
										<span className='text-xs'>Background</span>
									</div>
									<p className='text-sm font-medium text-gray-900 dark:text-white truncate'>
										{selectedBackground?.name || 'Not selected'}
									</p>
								</div>
								<div className='p-4 bg-gray-100 dark:bg-gray-800 rounded-xl'>
									<div className='flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1'>
										<Mic2 className='w-4 h-4' />
										<span className='text-xs'>Voice</span>
									</div>
									<p className='text-sm font-medium text-gray-900 dark:text-white truncate'>
										{selectedVoice?.name || 'Not selected'}
									</p>
								</div>
								<div className='p-4 bg-gray-100 dark:bg-gray-800 rounded-xl'>
									<div className='flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1'>
										<Music className='w-4 h-4' />
										<span className='text-xs'>Music</span>
									</div>
									<p className='text-sm font-medium text-gray-900 dark:text-white truncate'>
										{selectedMusic?.name || 'None'}
									</p>
								</div>
								<div className='p-4 bg-gray-100 dark:bg-gray-800 rounded-xl'>
									<div className='flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1'>
										<Type className='w-4 h-4' />
										<span className='text-xs'>Script</span>
									</div>
									<p className='text-sm font-medium text-gray-900 dark:text-white'>
										{editedScript.split(/\s+/).length} words
									</p>
								</div>
							</div>

							{/* Generated Video / Generate Button */}
							{finalVideoUrl ? (
								<div className='space-y-4'>
									<h3 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
										Generated Video
									</h3>
									<div className='aspect-video bg-black rounded-2xl overflow-hidden shadow-lg'>
										<video
											src={finalVideoUrl}
											controls
											className='w-full h-full'
											autoPlay
										/>
									</div>
									<div className='flex gap-4'>
										<a
											href={finalVideoUrl}
											target='_blank'
											rel='noopener noreferrer'
											className='flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-coral hover:bg-coral-light text-white rounded-xl font-medium transition-all'
										>
											<Download className='w-5 h-5' />
											Download Video
										</a>
										<button
											onClick={() => setFinalVideoUrl('')}
											className='flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-all hover:bg-gray-300 dark:hover:bg-gray-600'
										>
											<RefreshCw className='w-5 h-5' />
											Regenerate
										</button>
									</div>
								</div>
							) : (
								<button
									onClick={compositeVideo}
									disabled={compositing}
									className='w-full flex items-center justify-center gap-2 px-6 py-4 bg-coral hover:bg-coral-light text-white rounded-xl font-semibold text-lg transition-all disabled:opacity-50'
								>
									{compositing ? (
										<>
											<Loader2 className='w-6 h-6 animate-spin' />
											Generating Video... This may take a few minutes
										</>
									) : (
										<>
											<Wand2 className='w-6 h-6' />
											Generate Final Video
										</>
									)}
								</button>
							)}
						</div>
					</div>
				)}

				{/* Step 7: Schedule */}
				{currentStep === 7 && (
					<div className='space-y-6'>
						<div className='text-center mb-8'>
							<h2 className='text-xl font-semibold text-gray-900 dark:text-white'>
								Schedule Your Video
							</h2>
							<p className='text-gray-500 dark:text-gray-400 mt-2'>
								Choose when to publish your video to YouTube
							</p>
						</div>

						<div className='max-w-md mx-auto text-center py-12'>
							<Calendar className='w-16 h-16 mx-auto text-gray-400 mb-4' />
							<p className='text-gray-500 dark:text-gray-400'>
								Scheduling feature coming soon!
							</p>
							<p className='text-sm text-gray-400 mt-2'>
								For now, download your video and upload it manually to YouTube.
							</p>
						</div>
					</div>
				)}

				{/* Navigation */}
				<div className='flex justify-between mt-12 pt-6 border-t border-gray-200 dark:border-gray-800'>
					<button
						onClick={prevStep}
						disabled={currentStep === 1}
						className='flex items-center gap-2 px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed'
					>
						<ChevronLeft className='w-5 h-5' />
						Previous
					</button>
					<button
						onClick={nextStep}
						disabled={currentStep === STEPS.length || !canProceed()}
						className='flex items-center gap-2 px-6 py-3 bg-coral hover:bg-coral-light text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed'
					>
						{currentStep === STEPS.length ? 'Finish' : 'Next'}
						<ChevronRight className='w-5 h-5' />
					</button>
				</div>
			</div>

			{/* Video Preview Modal */}
			{previewVideo && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm'>
					<div className='relative mx-4'>
						{/* Close button */}
						<button
							onClick={() => {
								setPreviewVideo(null);
								setPreviewPlaying(false);
							}}
							className='absolute -top-12 right-0 p-2 text-white/80 hover:text-white transition-colors'
						>
							<X className='w-8 h-8' />
						</button>

						{/* Video container - 9:16 portrait for reels/shorts */}
						<div className='relative w-[360px] h-[640px] bg-black rounded-2xl overflow-hidden shadow-2xl'>
							<video
								ref={previewVideoRef}
								src={previewVideo.s3Url}
								className='w-full h-full object-cover'
								loop
								muted={previewMuted}
								autoPlay
								onPlay={() => setPreviewPlaying(true)}
								onPause={() => setPreviewPlaying(false)}
							/>

							{/* Video controls overlay */}
							<div className='absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20'>
								<button
									onClick={() => {
										if (previewVideoRef.current) {
											if (previewPlaying) {
												previewVideoRef.current.pause();
											} else {
												previewVideoRef.current.play();
											}
										}
									}}
									className='w-20 h-20 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all'
								>
									{previewPlaying ? (
										<Pause className='w-10 h-10 text-white' />
									) : (
										<Play className='w-10 h-10 text-white ml-1' />
									)}
								</button>
							</div>

							{/* Bottom controls */}
							<div className='absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent'>
								<div className='flex items-center justify-between'>
									<div>
										<h3 className='text-white font-semibold text-lg'>
											{previewVideo.name}
										</h3>
										{previewVideo.tags && previewVideo.tags.length > 0 && (
											<div className='flex gap-2 mt-1'>
												{previewVideo.tags.slice(0, 4).map((tag) => (
													<span
														key={tag}
														className='px-2 py-0.5 text-xs bg-white/20 text-white rounded-full'
													>
														{tag}
													</span>
												))}
											</div>
										)}
									</div>
									<div className='flex items-center gap-3'>
										<button
											onClick={() => setPreviewMuted(!previewMuted)}
											className='p-2 text-white/80 hover:text-white transition-colors'
										>
											{previewMuted ? (
												<VolumeX className='w-6 h-6' />
											) : (
												<Volume1 className='w-6 h-6' />
											)}
										</button>
										<button
											onClick={() => {
												setSelectedBackground(previewVideo);
												setPreviewVideo(null);
												setPreviewPlaying(false);
											}}
											className='px-4 py-2 bg-coral hover:bg-coral-light text-white rounded-lg font-medium transition-all flex items-center gap-2'
										>
											<Check className='w-4 h-4' />
											Select This Video
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
