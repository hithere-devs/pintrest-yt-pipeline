import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import {
	Sparkles,
	ArrowRight,
	Shield,
	Lock,
	Zap,
	Video,
	Brain,
	ChevronLeft,
} from 'lucide-react';

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

// --- Components ---

function AnimatedGradient() {
	return (
		<div className='absolute inset-0 overflow-hidden pointer-events-none select-none'>
			<div className='absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-coral/10 rounded-full blur-[120px] opacity-40 mix-blend-screen' />
			<div className='absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] opacity-30 mix-blend-screen' />
		</div>
	);
}

function FeatureBadge({
	icon: Icon,
	text,
}: {
	icon: React.ElementType;
	text: string;
}) {
	return (
		<motion.div
			variants={fadeInUp}
			className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-card/50 border border-dark-border backdrop-blur-sm'
		>
			<Icon className='w-3.5 h-3.5 text-coral' />
			<span className='text-xs text-gray-400'>{text}</span>
		</motion.div>
	);
}

export default function AuthPage() {
	const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

	const handleGoogleLogin = () => {
		window.location.href = `${API_URL}/auth/youtube`;
	};

	return (
		<div className='min-h-screen bg-dark-bg flex overflow-hidden'>
			{/* Left Panel - Branding & Visuals */}
			<motion.div
				initial='hidden'
				animate='visible'
				variants={staggerContainer}
				className='hidden lg:flex lg:w-1/2 relative p-12 flex-col justify-between bg-dark-card/20 border-r border-dark-border'
			>
				<AnimatedGradient />

				{/* Header */}
				<motion.div variants={fadeInUp} className='relative z-10'>
					<Link
						to='/'
						className='inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 group'
					>
						<ChevronLeft className='w-4 h-4 group-hover:-translate-x-1 transition-transform' />
						<span className='text-sm font-medium'>Back to home</span>
					</Link>

					<div className='flex items-center gap-3'>
						<div className='w-10 h-10 rounded-xl bg-linear-to-br from-coral to-coral-dark flex items-center justify-center shadow-lg shadow-coral/20'>
							<Sparkles className='w-5 h-5 text-white' />
						</div>
						<span className='text-2xl font-bold text-white tracking-tight'>
							ClipForge
						</span>
					</div>
				</motion.div>

				{/* Main Text */}
				<motion.div
					variants={staggerContainer}
					className='relative z-10 space-y-8'
				>
					<motion.h1
						variants={fadeInUp}
						className='text-4xl xl:text-6xl font-bold text-white leading-[1.1]'
					>
						Transform your videos
						<br />
						<span className='text-transparent bg-clip-text bg-linear-to-r from-coral to-coral-light'>
							into viral content.
						</span>
					</motion.h1>

					<motion.p
						variants={fadeInUp}
						className='text-lg text-gray-400 max-w-md leading-relaxed'
					>
						Join thousands of creators using AI to analyze, optimize, and
						generate content that performs.
					</motion.p>

					<motion.div
						variants={staggerContainer}
						className='flex flex-wrap gap-3'
					>
						<FeatureBadge icon={Brain} text='AI Analysis' />
						<FeatureBadge icon={Video} text='Smart Clipping' />
						<FeatureBadge icon={Zap} text='Instant Export' />
						<FeatureBadge icon={Shield} text='Secure' />
					</motion.div>
				</motion.div>

				{/* Footer/Testimonial */}
				<motion.div variants={fadeInUp} className='relative z-10'>
					<div className='p-6 rounded-2xl bg-dark-bg/50 border border-dark-border backdrop-blur-md'>
						<div className='flex items-center gap-4 mb-4'>
							<div className='flex -space-x-2'>
								{[1, 2, 3].map((i) => (
									<div
										key={i}
										className='w-8 h-8 rounded-full bg-dark-card border-2 border-dark-bg flex items-center justify-center text-xs text-gray-500'
									>
										U{i}
									</div>
								))}
							</div>
							<p className='text-sm text-gray-400'>
								Trusted by 10,000+ creators
							</p>
						</div>
						<p className='text-gray-500 text-xs'>
							© 2025 ClipForge. All rights reserved.
						</p>
					</div>
				</motion.div>
			</motion.div>

			{/* Right Panel - Auth Form */}
			<motion.div
				initial='hidden'
				animate='visible'
				variants={staggerContainer}
				className='flex-1 flex items-center justify-center p-8 relative'
			>
				<div className='absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-coral/5 via-dark-bg to-dark-bg pointer-events-none' />

				<div className='relative z-10 w-full max-w-md'>
					{/* Mobile Header */}
					<motion.div
						variants={fadeInUp}
						className='lg:hidden flex flex-col items-center mb-12'
					>
						<div className='w-12 h-12 rounded-xl bg-coral flex items-center justify-center mb-4'>
							<Sparkles className='w-6 h-6 text-white' />
						</div>
						<h1 className='text-2xl font-bold text-white'>ClipForge</h1>
					</motion.div>

					{/* Auth Card */}
					<motion.div
						variants={scaleIn}
						className='p-8 rounded-3xl bg-dark-card border border-dark-border shadow-2xl shadow-black/50'
					>
						<motion.div variants={fadeInUp} className='text-center mb-8'>
							<h2 className='text-2xl font-bold text-white mb-2'>
								Welcome back
							</h2>
							<p className='text-gray-400'>Sign in to access your dashboard</p>
						</motion.div>

						<motion.div variants={fadeInUp} className='space-y-4'>
							<button
								onClick={handleGoogleLogin}
								className='w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-4 px-6 rounded-xl hover:bg-gray-100 transition-all group relative overflow-hidden'
							>
								<img
									src='https://www.svgrepo.com/show/475656/google-color.svg'
									className='w-5 h-5'
									alt='Google'
								/>
								<span>Continue with Google</span>
								<ArrowRight className='w-4 h-4 ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all' />
							</button>
						</motion.div>

						<motion.div variants={fadeInUp} className='relative my-8'>
							<div className='absolute inset-0 flex items-center'>
								<div className='w-full border-t border-dark-border' />
							</div>
							<div className='relative flex justify-center'>
								<span className='px-4 bg-dark-card text-gray-500 text-xs uppercase tracking-wider'>
									Secure Access
								</span>
							</div>
						</motion.div>

						<motion.div
							variants={fadeInUp}
							className='flex items-center justify-center gap-6'
						>
							<div className='flex items-center gap-2 text-gray-500'>
								<Lock className='w-3 h-3' />
								<span className='text-xs'>Encrypted</span>
							</div>
							<div className='flex items-center gap-2 text-gray-500'>
								<Shield className='w-3 h-3' />
								<span className='text-xs'>Secure</span>
							</div>
						</motion.div>
					</motion.div>

					<motion.p
						variants={fadeInUp}
						className='text-center text-xs text-gray-500 mt-8'
					>
						By continuing, you agree to our Terms of Service and Privacy Policy.
					</motion.p>

					{/* Mobile Back Link */}
					<motion.div
						variants={fadeInUp}
						className='lg:hidden mt-8 text-center'
					>
						<Link
							to='/'
							className='inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm'
						>
							<ChevronLeft className='w-4 h-4' />
							Back to home
						</Link>
					</motion.div>
				</div>
			</motion.div>
		</div>
	);
}
