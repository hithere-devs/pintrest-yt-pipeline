import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, type Variants } from 'framer-motion';
import {
	Sparkles,
	Brain,
	Wand2,
	TrendingUp,
	Layers,
	Upload,
	ArrowRight,
	Scissors,
	Type,
	Hash,
	Frame,
	Share2,
	Play,
} from 'lucide-react';
import { Button } from '../components/ui/button';

// --- Animation Variants ---
const fadeInUp: Variants = {
	hidden: { opacity: 0, y: 30 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
	},
};

const staggerContainer: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.1, delayChildren: 0.1 },
	},
};

const scaleIn: Variants = {
	hidden: { opacity: 0, scale: 0.95 },
	visible: {
		opacity: 1,
		scale: 1,
		transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
	},
};

// --- Data ---
const aiFeatures = [
	{
		icon: Brain,
		title: 'Frame-by-Frame Analysis',
		description:
			'Deep AI analysis of every frame, detecting objects, scenes, and emotional moments.',
		colSpan: 'md:col-span-2',
	},
	{
		icon: Type,
		title: 'Transcript Extraction',
		description:
			'Automatic speech-to-text with context-aware content understanding.',
		colSpan: 'md:col-span-1',
	},
	{
		icon: TrendingUp,
		title: 'Algorithm-Optimized Titles',
		description:
			'AI-generated titles proven to maximize click-through and engagement.',
		colSpan: 'md:col-span-1',
	},
	{
		icon: Hash,
		title: 'Viral Hashtag Sets',
		description:
			'Data-driven hashtag recommendations based on trending performance.',
		colSpan: 'md:col-span-2',
	},
	{
		icon: Scissors,
		title: 'Smart Clip Detection',
		description:
			'Automatically identify high-viral-potential moments for short-form content.',
		colSpan: 'md:col-span-1',
	},
	{
		icon: Frame,
		title: 'AI Smart Framing',
		description:
			'Dynamic camera framing that keeps subjects centered in vertical formats.',
		colSpan: 'md:col-span-2',
	},
];

const pipelineSteps = [
	{
		icon: Sparkles,
		title: 'Idea Generation',
		desc: 'Fetch viral concepts',
	},
	{
		icon: Upload,
		title: 'Import',
		desc: 'Direct, Boards, Collections',
	},
	{
		icon: Wand2,
		title: 'AI Processing',
		desc: 'Analyze & Enhance',
	},
	{
		icon: Layers,
		title: 'Render',
		desc: 'Unified Export',
	},
	{
		icon: Share2,
		title: 'Publish',
		desc: 'Direct to Platforms',
	},
];

// --- Components ---

function AnimatedGradient() {
	return (
		<div className='absolute inset-0 overflow-hidden pointer-events-none select-none'>
			<div className='absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-coral/10 rounded-full blur-[120px] opacity-50 mix-blend-screen' />
			<div className='absolute bottom-0 right-0 w-[800px] h-[600px] bg-blue-500/5 rounded-full blur-[120px] opacity-30 mix-blend-screen' />
			<div className='absolute top-1/3 left-0 w-[600px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] opacity-30 mix-blend-screen' />
		</div>
	);
}

function Navigation() {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const handleScroll = () => setScrolled(window.scrollY > 20);
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	return (
		<motion.header
			initial={{ y: -100 }}
			animate={{ y: 0 }}
			transition={{ duration: 0.6, ease: 'easeOut' }}
			className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
				scrolled
					? 'bg-dark-bg/80 backdrop-blur-xl border-b border-dark-border'
					: 'bg-transparent'
			}`}
		>
			<div className='max-w-7xl mx-auto px-6 h-20 flex items-center justify-between'>
				<Link to='/' className='flex items-center gap-3 group'>
					<div className='w-10 h-10 rounded-xl bg-linear-to-br from-coral to-coral-dark flex items-center justify-center shadow-lg shadow-coral/20 group-hover:scale-105 transition-transform'>
						<Sparkles className='w-5 h-5 text-white' />
					</div>
					<span className='text-xl font-bold text-white tracking-tight'>
						ClipForge
					</span>
				</Link>

				<nav className='hidden md:flex items-center gap-8'>
					{['Features', 'Intelligence', 'Pipeline'].map((item) => (
						<a
							key={item}
							href={`#${item.toLowerCase()}`}
							className='text-sm font-medium text-gray-400 hover:text-white transition-colors'
						>
							{item}
						</a>
					))}
				</nav>

				<div className='flex items-center gap-4'>
					<Link
						to='/auth'
						className='text-sm font-medium text-gray-300 hover:text-white transition-colors hidden sm:block'
					>
						Sign In
					</Link>
					<Link to='/auth'>
						<Button className='bg-white text-dark-bg hover:bg-gray-100 font-semibold rounded-full px-6'>
							Get Started
						</Button>
					</Link>
				</div>
			</div>
		</motion.header>
	);
}

function HeroSection() {
	const { scrollY } = useScroll();
	const y1 = useTransform(scrollY, [0, 500], [0, 200]);
	const y2 = useTransform(scrollY, [0, 500], [0, -150]);

	return (
		<section className='relative min-h-screen flex items-center justify-center pt-20 overflow-hidden'>
			<AnimatedGradient />

			{/* Grid Background */}
			<div className='absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px] mask-[radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]' />

			<div className='relative z-10 max-w-6xl mx-auto px-6 text-center'>
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6 }}
					className='inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dark-card/50 border border-dark-border backdrop-blur-md mb-8 hover:border-coral/30 transition-colors cursor-default'
				>
					<span className='relative flex h-2 w-2'>
						<span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-coral opacity-75'></span>
						<span className='relative inline-flex rounded-full h-2 w-2 bg-coral'></span>
					</span>
					<span className='text-sm font-medium text-gray-300'>
						AI Video Intelligence v2.0
					</span>
				</motion.div>

				<motion.h1
					initial={{ opacity: 0, y: 30 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.1 }}
					className='text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-8 tracking-tight leading-[1.1]'
				>
					Plan. Manage.
					<br />
					<span className='text-transparent bg-clip-text bg-linear-to-r from-coral via-coral-light to-white'>
						Go Viral.
					</span>
				</motion.h1>

				<motion.p
					initial={{ opacity: 0, y: 30 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.2 }}
					className='text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed'
				>
					The complete pipeline for modern creators. From frame-by-frame AI
					analysis to automated viral content generation.
				</motion.p>

				<motion.div
					initial={{ opacity: 0, y: 30 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.3 }}
					className='flex flex-col sm:flex-row items-center justify-center gap-4'
				>
					<Link to='/auth'>
						<Button
							size='lg'
							className='h-14 px-8 rounded-full bg-coral hover:bg-coral-dark text-white text-lg font-semibold shadow-lg shadow-coral/25 transition-all hover:scale-105'
						>
							Start Creating Free
							<ArrowRight className='ml-2 w-5 h-5' />
						</Button>
					</Link>
					<Button
						size='lg'
						variant='outline'
						className='h-14 px-8 rounded-full border-dark-border bg-dark-card/50 hover:bg-dark-card text-white text-lg backdrop-blur-sm'
					>
						<Play className='mr-2 w-5 h-5 fill-current' />
						Watch Demo
					</Button>
				</motion.div>
			</div>

			{/* Floating UI Elements for Visual Interest - Positioned relative to viewport */}
			<motion.div
				style={{ y: y1 }}
				className='absolute top-1/4 left-8 xl:left-24 hidden lg:block p-4 rounded-2xl bg-dark-card/80 border border-dark-border backdrop-blur-xl shadow-2xl max-w-xs text-left z-20'
			>
				<div className='flex items-center gap-3 mb-3'>
					<div className='w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center'>
						<TrendingUp className='w-4 h-4 text-green-500' />
					</div>
					<div>
						<p className='text-sm font-medium text-white'>Viral Potential</p>
						<p className='text-xs text-gray-400'>Analysis Complete</p>
					</div>
				</div>
				<div className='h-2 bg-dark-bg rounded-full overflow-hidden'>
					<div className='h-full w-[92%] bg-green-500 rounded-full' />
				</div>
			</motion.div>

			<motion.div
				style={{ y: y2 }}
				className='absolute bottom-1/4 right-8 xl:right-24 hidden lg:block p-4 rounded-2xl bg-dark-card/80 border border-dark-border backdrop-blur-xl shadow-2xl max-w-xs text-left z-20'
			>
				<div className='flex items-center gap-3 mb-2'>
					<div className='w-8 h-8 rounded-lg bg-coral/20 flex items-center justify-center'>
						<Brain className='w-4 h-4 text-coral' />
					</div>
					<p className='text-sm font-medium text-white'>Smart Framing</p>
				</div>
				<div className='aspect-9/16 w-24 bg-dark-bg rounded-lg border border-dark-border relative overflow-hidden'>
					<div className='absolute inset-0 flex items-center justify-center'>
						<div className='w-12 h-12 rounded-full border-2 border-coral opacity-50' />
					</div>
				</div>
			</motion.div>
		</section>
	);
}

function BentoGrid() {
	return (
		<section id='intelligence' className='py-32 px-6 relative'>
			<div className='max-w-7xl mx-auto'>
				<motion.div
					initial='hidden'
					whileInView='visible'
					viewport={{ once: true, margin: '-100px' }}
					variants={staggerContainer}
					className='mb-16 text-center'
				>
					<h2 className='text-4xl md:text-5xl font-bold text-white mb-6'>
						Intelligence built-in
					</h2>
					<p className='text-gray-400 text-lg max-w-2xl mx-auto'>
						Our AI engine processes every pixel to give you unfair advantages.
					</p>
				</motion.div>

				<motion.div
					initial='hidden'
					whileInView='visible'
					viewport={{ once: true, margin: '-100px' }}
					variants={staggerContainer}
					className='grid grid-cols-1 md:grid-cols-3 gap-6'
				>
					{aiFeatures.map((feature, index) => (
						<motion.div
							key={index}
							variants={scaleIn}
							className={`${feature.colSpan} group relative p-8 rounded-3xl bg-dark-card border border-dark-border hover:border-coral/30 transition-all duration-500 overflow-hidden`}
						>
							<div className='absolute inset-0 bg-linear-to-br from-coral/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500' />

							<div className='relative z-10'>
								<div className='w-12 h-12 rounded-2xl bg-dark-bg border border-dark-border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500'>
									<feature.icon className='w-6 h-6 text-coral' />
								</div>
								<h3 className='text-xl font-bold text-white mb-3'>
									{feature.title}
								</h3>
								<p className='text-gray-400 leading-relaxed'>
									{feature.description}
								</p>
							</div>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}

function PipelineSection() {
	return (
		<section id='pipeline' className='py-32 px-6 relative bg-dark-card/30'>
			<div className='max-w-7xl mx-auto'>
				<motion.div
					initial='hidden'
					whileInView='visible'
					viewport={{ once: true }}
					variants={staggerContainer}
					className='text-center mb-20'
				>
					<h2 className='text-4xl md:text-5xl font-bold text-white mb-6'>
						Viral Content Pipeline
					</h2>
					<p className='text-gray-400 text-lg max-w-2xl mx-auto'>
						A unified workflow to take you from raw idea to published hit.
					</p>
				</motion.div>

				<div className='relative'>
					{/* Connecting Line */}
					<div className='hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-coral/30 to-transparent' />

					<div className='grid grid-cols-1 md:grid-cols-5 gap-8'>
						{pipelineSteps.map((step, index) => (
							<motion.div
								key={index}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ delay: index * 0.1 }}
								className='relative flex flex-col items-center text-center group'
							>
								<div className='w-24 h-24 rounded-3xl bg-dark-bg border border-dark-border flex items-center justify-center mb-6 relative z-10 group-hover:border-coral/50 group-hover:shadow-lg group-hover:shadow-coral/10 transition-all duration-300'>
									<step.icon className='w-10 h-10 text-gray-400 group-hover:text-coral transition-colors duration-300' />
								</div>
								<h3 className='text-lg font-bold text-white mb-2'>
									{step.title}
								</h3>
								<p className='text-sm text-gray-500'>{step.desc}</p>
							</motion.div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}

function CTASection() {
	return (
		<section className='py-32 px-6 relative overflow-hidden flex items-center justify-center min-h-[60vh]'>
			{/* Animated Background */}
			<div className='absolute inset-0 pointer-events-none'>
				<motion.div
					animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
					transition={{ duration: 8, repeat: Infinity }}
					className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-coral/20 rounded-full blur-[120px]'
				/>
				<div className='absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0f0f0f_70%)]' />
			</div>

			<motion.div
				initial='hidden'
				whileInView='visible'
				viewport={{ once: true }}
				variants={staggerContainer}
				className='max-w-5xl mx-auto text-center relative z-10'
			>
				{/* Floating Icons */}
				<motion.div
					animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
					transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
					className='absolute -top-20 left-0 md:left-20 text-coral/30 hidden md:block'
				>
					<Sparkles size={64} />
				</motion.div>
				<motion.div
					animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
					transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
					className='absolute -bottom-10 right-0 md:right-20 text-blue-500/30 hidden md:block'
				>
					<TrendingUp size={64} />
				</motion.div>

				<motion.h2
					variants={fadeInUp}
					className='text-6xl md:text-8xl font-bold text-white mb-8 tracking-tighter'
				>
					Ready to go
					<br />
					<span className='relative inline-block'>
						<span className='relative z-10 text-transparent bg-clip-text bg-linear-to-r from-coral via-purple-500 to-coral bg-size-[200%_auto] animate-[gradient_3s_linear_infinite]'>
							super viral?
						</span>
						{/* Underline effect */}
						<motion.span
							className='absolute -bottom-2 left-0 right-0 h-4 bg-coral/30 -rotate-2 blur-xl'
							initial={{ scaleX: 0 }}
							whileInView={{ scaleX: 1 }}
							transition={{ delay: 0.5, duration: 0.8 }}
						/>
					</span>
				</motion.h2>

				<motion.p
					variants={fadeInUp}
					className='text-xl text-gray-400 mb-12 max-w-2xl mx-auto'
				>
					Join the creators who are dominating the feed. No credit card required.
				</motion.p>

				<motion.div
					variants={fadeInUp}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
				>
					<Link to='/auth'>
						<Button
							size='lg'
							className='h-20 px-12 rounded-full bg-white text-dark-bg hover:bg-gray-100 text-2xl font-bold shadow-[0_0_60px_-15px_rgba(255,255,255,0.3)] transition-all group relative overflow-hidden'
						>
							<span className='relative z-10 flex items-center gap-3'>
								Start Creating Now
								<ArrowRight className='w-6 h-6 group-hover:translate-x-1 transition-transform' />
							</span>
							{/* Shimmer effect */}
							<div className='absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-linear-to-r from-transparent via-gray-200/30 to-transparent z-0' />
						</Button>
					</Link>
				</motion.div>
			</motion.div>
		</section>
	);
}

export default function LandingPage() {
	return (
		<div className='min-h-screen bg-dark-bg text-white selection:bg-coral/30'>
			<Navigation />
			<HeroSection />
			<BentoGrid />
			<PipelineSection />
			<CTASection />

			<footer className='py-12 px-6 border-t border-dark-border bg-dark-bg'>
				<div className='max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6'>
					<div className='flex items-center gap-2'>
						<div className='w-8 h-8 rounded-lg bg-coral flex items-center justify-center'>
							<Sparkles className='w-4 h-4 text-white' />
						</div>
						<span className='font-bold text-white'>ClipForge</span>
					</div>
					<p className='text-gray-500 text-sm'>
						© 2025 ClipForge. All rights reserved.
					</p>
				</div>
			</footer>
		</div>
	);
}
