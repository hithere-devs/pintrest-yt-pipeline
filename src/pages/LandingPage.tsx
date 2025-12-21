import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, type Variants } from 'framer-motion';
import {
	Sparkles,
	TrendingUp,
	ArrowRight,
	Scissors,
	Hash,
	Frame,
	Share2,
	DollarSign,
	BarChart3,
	Zap,
	Gem,
	Fingerprint,
	LineChart,
	Check,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import logoDark from '../assets/logo-dark-trans.png';
import logoLight from '../assets/logo-light-trans.png';

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
		icon: Gem,
		title: 'The Creation Engine',
		description:
			'Generate high-quality video content from a single prompt. Our engine combines viral audio hooks, satisfying visual loops, and retention-optimized scripts to create engaging content instantly.',
		colSpan: 'md:col-span-2',
	},
	{
		icon: LineChart,
		title: 'Viral Prediction',
		description:
			'Don\'t guess—know. Our AI analyzes millions of data points to predict the "Viral Potential" of your concept before you even render it. Only ship what wins.',
		colSpan: 'md:col-span-1',
	},
	{
		icon: Fingerprint,
		title: 'Synthetic Identity',
		description:
			'Scale your personal brand to infinity. Clone your voice or utilize our roster of "High-Trust" narrators to produce content while you sleep.',
		colSpan: 'md:col-span-1',
	},
	{
		icon: Hash,
		title: 'Market Signals',
		description:
			'Data-driven hashtag recommendations based on trending performance.',
		colSpan: 'md:col-span-2',
	},
	{
		icon: Scissors,
		title: 'Smart Clip Detection',
		description:
			'Automatically identify high-yield moments for short-form content.',
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
		icon: DollarSign,
		title: 'Input Ideas',
		desc: 'Enter a Topic/Prompt',
	},
	{
		icon: Gem,
		title: 'Create',
		desc: 'AI Generates Video',
	},
	{
		icon: LineChart,
		title: 'Analyze',
		desc: 'Score Viral Potential',
	},
	{
		icon: Share2,
		title: 'Publish',
		desc: 'Post to Platforms',
	},
];

const pricingPlans = [
	{
		name: 'Creator',
		description: 'For individuals validating their niche.',
		price: 'Free',
		features: ['5 Videos/Month', 'Watermarked Content', 'Basic Analytics'],
		cta: 'Start Creating',
		popular: false,
	},
	{
		name: 'Professional',
		description: 'For aggressive channel scaling.',
		price: '$29',
		period: '/mo',
		features: [
			'100 Videos/Month',
			'Viral Prediction',
			'Voice Cloning',
			'No Watermark',
			'Priority Queue',
		],
		cta: 'Go Pro',
		popular: true,
	},
	{
		name: 'Agency',
		description: 'For networks managing multiple channels.',
		price: '$99',
		period: '/mo',
		features: [
			'Unlimited Creation',
			'API Access',
			'Priority Queues',
			'Dedicated Account Manager',
			'White Labeling',
		],
		cta: 'Contact Sales',
		popular: false,
	},
];

// --- Components ---

function RevenueTicker() {
	return (
		<div className='w-full bg-black border-b border-white/5 overflow-hidden py-2'>
			<motion.div
				animate={{ x: ['0%', '-50%'] }}
				transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
				className='flex items-center gap-12 whitespace-nowrap'
			>
				{[...Array(4)].map((_, i) => (
					<div
						key={i}
						className='flex items-center gap-8 text-sm font-medium font-sans'
					>
						<span className='flex items-center gap-2 text-emerald-400'>
							<TrendingUp className='w-4 h-4' />
							VIEWS ▲ 1.2M
						</span>
						<span className='flex items-center gap-2 text-emerald-400'>
							<DollarSign className='w-4 h-4' />
							REV ▲ $4.2K
						</span>
						<span className='flex items-center gap-2 text-lime-400'>
							<Zap className='w-4 h-4' />
							REACH: 99 ▲
						</span>
						<span className='flex items-center gap-2 text-emerald-400'>
							<BarChart3 className='w-4 h-4' />
							CPM: $12.50 ▲
						</span>
					</div>
				))}
			</motion.div>
		</div>
	);
}

function AnimatedGradient() {
	return (
		<div className='absolute inset-0 overflow-hidden pointer-events-none select-none'>
			<div className='absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] opacity-30 mix-blend-screen' />
			<div className='absolute bottom-0 right-0 w-[800px] h-[600px] bg-lime-500/5 rounded-full blur-[120px] opacity-20 mix-blend-screen' />
		</div>
	);
}

function Navigation() {
	const [_, setScrolled] = useState(false);

	useEffect(() => {
		const handleScroll = () => setScrolled(window.scrollY > 20);
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	return (
		<motion.header
			initial={{ y: -100, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
			className='fixed top-10 left-0 right-0 z-50 flex justify-center px-4'
		>
			<div className='w-full max-w-5xl rounded-full border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl shadow-black/50 px-6 h-16 flex items-center justify-between'>
				<Link to='/' className='flex items-center group select-none'>
					<img
						src={logoLight}
						alt='Clipmil Logo'
						className='h-10 w-auto pointer-events-none'
					/>
					<span className='font-display font-semibold text-white text-lg tracking-tight mt-px'>
						Clipmil
					</span>
				</Link>

				<nav className='hidden md:flex items-center gap-8'>
					{['Platform', 'Market Data', 'Plans'].map((item) => (
						<a
							key={item}
							href={`#${item.toLowerCase().replace(' ', '-')}`}
							className='text-sm font-medium text-gray-400 hover:text-white transition-colors font-sans'
						>
							{item}
						</a>
					))}
				</nav>

				<div className='flex items-center gap-4'>
					<Link
						to='/auth'
						className='text-sm font-medium text-gray-300 hover:text-white transition-colors hidden sm:block font-sans'
					>
						Sign In
					</Link>
					<Link to='/auth'>
						<Button className='btn-money text-white font-semibold rounded-full px-6 h-9 text-sm font-sans'>
							Start Creating
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
		<section className='relative min-h-screen flex items-center justify-center pt-20 overflow-hidden bg-black'>
			<AnimatedGradient />

			{/* Subtle Grid Background */}
			<div className='absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-size-[40px_40px] mask-[radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]' />

			<div className='relative z-10 max-w-6xl mx-auto px-6 text-center'>
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6 }}
					className='inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 hover:bg-white/10 transition-colors cursor-default'
				>
					<span className='relative flex h-2 w-2'>
						<span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75'></span>
						<span className='relative inline-flex rounded-full h-2 w-2 bg-emerald-500'></span>
					</span>
					<span className='text-sm font-medium text-gray-300 font-sans'>
						Viral Content Engine v2.0
					</span>
				</motion.div>

				<motion.h1
					initial={{ opacity: 0, y: 30 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.1 }}
					className='text-6xl md:text-8xl lg:text-9xl font-bold text-white mb-8 tracking-tight leading-[1] font-display'
				>
					Turn Ideas
					<br />
					<span className='text-transparent bg-clip-text bg-linear-to-r from-emerald-400 via-lime-300 to-white'>
						Into Viral Content.
					</span>
				</motion.h1>

				<motion.p
					initial={{ opacity: 0, y: 30 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.2 }}
					className='text-xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed font-sans'
				>
					Clipmil is the high-velocity content engine for creators. Turn raw
					concepts into engaging videos, predict viral potential with AI, Scale
					and Automate your channel.
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
							className='btn-money h-14 px-8 rounded-full text-white text-lg font-semibold transition-all hover:scale-105 font-sans'
						>
							Start Creating Now
							<ArrowRight className='ml-2 w-5 h-5' />
						</Button>
					</Link>
					<Button
						size='lg'
						variant='outline'
						className='h-14 px-8 rounded-full border-white/10 bg-white/5 hover:bg-white/10 text-white text-lg backdrop-blur-sm font-sans'
					>
						<LineChart className='mr-2 w-5 h-5 text-emerald-500' />
						Explore Market Data
					</Button>
				</motion.div>
			</div>

			{/* Floating UI Elements for Visual Interest - Positioned relative to viewport */}
			<motion.div
				style={{ y: y1 }}
				className='absolute top-1/4 left-8 xl:left-24 hidden lg:block p-4 rounded-2xl bg-black/80 border border-white/10 backdrop-blur-xl shadow-2xl max-w-xs text-left z-20'
			>
				<div className='flex items-center gap-3 mb-3'>
					<div className='w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center'>
						<TrendingUp className='w-4 h-4 text-emerald-500' />
					</div>
					<div>
						<p className='text-sm font-medium text-white font-sans'>
							Viral Potential
						</p>
						<p className='text-xs text-gray-400 font-sans'>Analysis Complete</p>
					</div>
				</div>
				<div className='h-2 bg-white/10 rounded-full overflow-hidden'>
					<div className='h-full w-[92%] bg-emerald-500 rounded-full' />
				</div>
			</motion.div>

			<motion.div
				style={{ y: y2 }}
				className='absolute bottom-1/4 right-8 xl:right-24 hidden lg:block p-4 rounded-2xl bg-black/80 border border-white/10 backdrop-blur-xl shadow-2xl max-w-xs text-left z-20'
			>
				<div className='flex items-center gap-3 mb-2'>
					<div className='w-8 h-8 rounded-lg bg-lime-500/20 flex items-center justify-center'>
						<DollarSign className='w-4 h-4 text-lime-500' />
					</div>
					<p className='text-sm font-medium text-white font-sans'>
						Est. Revenue
					</p>
				</div>
				<div className='text-2xl font-bold text-white font-display'>
					$1,240.50
				</div>
				<p className='text-xs text-emerald-400 flex items-center mt-1 font-sans'>
					<TrendingUp className='w-3 h-3 mr-1' /> +12.5% today
				</p>
			</motion.div>
		</section>
	);
}

// function SocialProof() {
// 	return (
// 		<section className='py-12 border-y border-white/5 bg-black'>
// 			<div className='max-w-7xl mx-auto px-6'>
// 				<div className='text-center mb-8'>
// 					<h3 className='text-lg font-medium text-gray-500 font-sans'>
// 						Powering the Creator Economy
// 					</h3>
// 				</div>
// 				<div className='grid grid-cols-1 md:grid-cols-3 gap-8 text-center'>
// 					<div>
// 						<div className='text-5xl font-bold text-white font-display mb-2'>
// 							10M+
// 						</div>
// 						<div className='text-emerald-500 font-medium font-sans'>
// 							Views Generated
// 						</div>
// 					</div>
// 					<div>
// 						<div className='text-5xl font-bold text-white font-display mb-2'>
// 							50k+
// 						</div>
// 						<div className='text-emerald-500 font-medium font-sans'>
// 							Videos Created
// 						</div>
// 					</div>
// 					<div>
// 						<div className='text-5xl font-bold text-white font-display mb-2'>
// 							$2M+
// 						</div>
// 						<div className='text-emerald-500 font-medium font-sans'>
// 							Creator Revenue Generated
// 						</div>
// 					</div>
// 				</div>
// 			</div>
// 		</section>
// 	);
// }

// function ProblemSection() {
// 	return (
// 		<section className='py-32 px-6 relative bg-black'>
// 			<div className='max-w-7xl mx-auto'>
// 				<div className='grid grid-cols-1 lg:grid-cols-2 gap-12 items-center'>
// 					<motion.div
// 						initial={{ opacity: 0, x: -50 }}
// 						whileInView={{ opacity: 1, x: 0 }}
// 						viewport={{ once: true }}
// 						className='p-8 rounded-3xl bg-white/5 border border-white/10 grayscale opacity-70'
// 					>
// 						<h3 className='text-3xl font-bold text-gray-400 mb-4 font-display'>
// 							Manual Creation
// 						</h3>
// 						<p className='text-gray-500 mb-6 font-sans text-lg'>
// 							Every hour you spend editing is lost reach. The algorithm rewards
// 							volume and consistency. While you labor over one video, the trend
// 							moves on.
// 						</p>
// 						<ul className='space-y-3 text-gray-500 font-sans'>
// 							<li className='flex items-center gap-2'>
// 								<span className='text-red-500'>✕</span> 1 Video/Day
// 							</li>
// 							<li className='flex items-center gap-2'>
// 								<span className='text-red-500'>✕</span> High Burnout
// 							</li>
// 							<li className='flex items-center gap-2'>
// 								<span className='text-red-500'>✕</span> Linear Growth
// 							</li>
// 						</ul>
// 					</motion.div>

// 					<motion.div
// 						initial={{ opacity: 0, x: 50 }}
// 						whileInView={{ opacity: 1, x: 0 }}
// 						viewport={{ once: true }}
// 						className='p-8 rounded-3xl bg-emerald-900/10 border border-emerald-500/30 relative overflow-hidden'
// 					>
// 						<div className='absolute inset-0 bg-guilloche opacity-10' />
// 						<div className='relative z-10'>
// 							<h3 className='text-3xl font-bold text-white mb-4 font-display'>
// 								Clipmil Automated
// 							</h3>
// 							<p className='text-gray-300 mb-6 font-sans text-lg'>
// 								Stop acting like an editor; start acting like a media empire.
// 								Scale your channel with automated content creation.
// 							</p>
// 							<ul className='space-y-3 text-white font-sans'>
// 								<li className='flex items-center gap-2'>
// 									<Check className='text-lime-500' size={18} /> 50 Videos/Day
// 								</li>
// 								<li className='flex items-center gap-2'>
// 									<Check className='text-lime-500' size={18} /> Zero Fatigue
// 								</li>
// 								<li className='flex items-center gap-2'>
// 									<Check className='text-lime-500' size={18} /> Exponential
// 									Reach
// 								</li>
// 							</ul>
// 						</div>
// 					</motion.div>
// 				</div>
// 				<div className='text-center mt-16'>
// 					<h2 className='text-4xl md:text-5xl font-bold text-white font-display'>
// 						Manual Creation is a Bottleneck.
// 					</h2>
// 				</div>
// 			</div>
// 		</section>
// 	);
// }

function BentoGrid() {
	return (
		<section id='platform' className='py-32 px-6 relative bg-black'>
			<div className='max-w-7xl mx-auto'>
				<motion.div
					initial='hidden'
					whileInView='visible'
					viewport={{ once: true, margin: '-100px' }}
					variants={staggerContainer}
					className='mb-16 text-center'
				>
					<h2 className='text-5xl md:text-6xl font-bold text-white mb-6 font-display'>
						The Growth Engine
					</h2>
					<p className='text-gray-400 text-lg max-w-2xl mx-auto font-sans'>
						Professional-grade tools for content creation and management.
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
							className={`${feature.colSpan} group relative p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-all duration-500 overflow-hidden`}
						>
							<div className='absolute inset-0 bg-linear-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500' />

							<div className='relative z-10'>
								<div className='w-12 h-12 rounded-2xl bg-black border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500'>
									<feature.icon className='w-6 h-6 text-emerald-500' />
								</div>
								<h3 className='text-2xl font-bold text-white mb-3 font-display'>
									{feature.title}
								</h3>
								<p className='text-gray-400 leading-relaxed font-sans'>
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
		<section id='market-data' className='py-32 px-6 relative bg-black'>
			<div className='max-w-7xl mx-auto'>
				<motion.div
					initial='hidden'
					whileInView='visible'
					viewport={{ once: true }}
					variants={staggerContainer}
					className='text-center mb-20'
				>
					<h2 className='text-5xl md:text-6xl font-bold text-white mb-6 font-display'>
						Your Content Pipeline
					</h2>
					<p className='text-gray-400 text-lg max-w-2xl mx-auto font-sans'>
						A unified workflow to take you from raw idea to published video.
					</p>
				</motion.div>

				<div className='relative'>
					{/* Connecting Line */}
					<div className='hidden md:block absolute top-12 left-0 right-0 h-px bg-linear-to-r from-transparent via-emerald-500/30 to-transparent' />

					<div className='grid grid-cols-1 md:grid-cols-4 gap-8'>
						{pipelineSteps.map((step, index) => (
							<motion.div
								key={index}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ delay: index * 0.1 }}
								className='relative flex flex-col items-center text-center group'
							>
								<div className='w-24 h-24 rounded-3xl bg-black border border-white/10 flex items-center justify-center mb-6 relative z-10 group-hover:border-emerald-500/50 group-hover:shadow-lg group-hover:shadow-emerald-500/10 transition-all duration-300'>
									<step.icon className='w-10 h-10 text-gray-400 group-hover:text-emerald-500 transition-colors duration-300' />
								</div>
								<h3 className='text-xl font-bold text-white mb-2 font-display'>
									{step.title}
								</h3>
								<p className='text-sm text-gray-500 font-sans'>{step.desc}</p>
							</motion.div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}

function PricingSection() {
	return (
		<section id='plans' className='py-32 px-6 relative bg-black'>
			<div className='max-w-7xl mx-auto'>
				<div className='text-center mb-16'>
					<h2 className='text-5xl md:text-6xl font-bold text-white mb-6 font-display'>
						Choose Your Scale
					</h2>
					<p className='text-gray-400 text-lg max-w-2xl mx-auto font-sans'>
						Select the plan that matches your channel goals.
					</p>
				</div>

				<div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
					{pricingPlans.map((plan, index) => (
						<motion.div
							key={index}
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ delay: index * 0.1 }}
							className={`relative p-8 rounded-3xl border ${
								plan.popular
									? 'bg-emerald-900/10 border-emerald-500/50 shadow-2xl shadow-emerald-500/10'
									: 'bg-white/5 border-white/10'
							}`}
						>
							{plan.popular && (
								<div className='absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full uppercase tracking-wider font-sans'>
									Most Popular
								</div>
							)}
							<h3 className='text-2xl font-bold text-white mb-2 font-display'>
								{plan.name}
							</h3>
							<p className='text-gray-400 text-sm mb-6 h-10 font-sans'>
								{plan.description}
							</p>
							<div className='flex items-baseline gap-1 mb-8'>
								<span className='text-5xl font-bold text-white font-display'>
									{plan.price}
								</span>
								{plan.period && (
									<span className='text-gray-500 font-sans'>{plan.period}</span>
								)}
							</div>
							<ul className='space-y-4 mb-8'>
								{plan.features.map((feature, i) => (
									<li
										key={i}
										className='flex items-center gap-3 text-gray-300 text-sm font-sans'
									>
										<Check className='w-4 h-4 text-emerald-500' />
										{feature}
									</li>
								))}
							</ul>
							<Button
								className={`w-full h-12 rounded-xl font-semibold font-sans ${
									plan.popular
										? 'btn-money text-white'
										: 'bg-white/10 text-white hover:bg-white/20'
								}`}
							>
								{plan.cta}
							</Button>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}

function CTASection() {
	return (
		<section className='py-32 px-6 relative overflow-hidden flex items-center justify-center min-h-[60vh] bg-black'>
			{/* Animated Background */}
			<div className='absolute inset-0 pointer-events-none'>
				<motion.div
					animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
					transition={{ duration: 8, repeat: Infinity }}
					className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-[120px]'
				/>
				<div className='absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_70%)]' />
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
					className='absolute -top-20 left-0 md:left-20 text-emerald-500/30 hidden md:block'
				>
					<Sparkles size={64} />
				</motion.div>
				<motion.div
					animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
					transition={{
						duration: 6,
						repeat: Infinity,
						ease: 'easeInOut',
						delay: 1,
					}}
					className='absolute -bottom-10 right-0 md:right-20 text-lime-500/30 hidden md:block'
				>
					<TrendingUp size={64} />
				</motion.div>

				<motion.h2
					variants={fadeInUp}
					className='text-6xl md:text-8xl font-bold text-white mb-8 tracking-tighter font-display'
				>
					Ready to create
					<br />
					<span className='relative inline-block'>
						<span className='relative z-10 text-transparent bg-clip-text bg-linear-to-r from-emerald-400 via-lime-400 to-emerald-400 bg-size-[200%_auto] animate-[gradient_3s_linear_infinite]'>
							your next hit?
						</span>
						{/* Underline effect */}
						<motion.span
							className='absolute -bottom-2 left-0 right-0 h-4 bg-emerald-500/30 -rotate-2 blur-xl'
							initial={{ scaleX: 0 }}
							whileInView={{ scaleX: 1 }}
							transition={{ delay: 0.5, duration: 0.8 }}
						/>
					</span>
				</motion.h2>

				<motion.p
					variants={fadeInUp}
					className='text-xl text-gray-400 mb-12 max-w-2xl mx-auto font-sans'
				>
					Join the creators who are dominating the feed. No credit card
					required.
				</motion.p>

				<motion.div
					variants={fadeInUp}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
				>
					<Link to='/auth'>
						<Button
							size='lg'
							className='h-20 px-12 rounded-full bg-white text-black hover:bg-gray-100 text-2xl font-bold shadow-[0_0_60px_-15px_rgba(255,255,255,0.3)] transition-all group relative overflow-hidden font-sans'
						>
							<span className='relative z-10 flex items-center gap-3 text-white'>
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
		<div className='min-h-screen bg-black text-white selection:bg-emerald-500/30 font-sans'>
			<RevenueTicker />
			<Navigation />
			<HeroSection />
			{/* <SocialProof /> */}
			{/* <ProblemSection /> */}
			<BentoGrid />
			<PipelineSection />
			<PricingSection />
			<CTASection />

			<footer className='py-12 px-6 border-t border-white/5 bg-black'>
				<div className='max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6'>
					<div className='flex items-center select-none'>
						<img
							src={logoDark}
							alt='Clipmil Logo'
							className='h-10 w-auto pointer-events-none'
						/>
						<span className='font-display font-semibold text-white text-lg tracking-tight mt-px'>
							Clipmil
						</span>
					</div>
					<div className='flex gap-8 text-sm text-gray-500 font-sans'>
						<a href='#' className='hover:text-emerald-500 transition-colors'>
							Content Vault
						</a>
						<a href='#' className='hover:text-emerald-500 transition-colors'>
							Support
						</a>
						<a href='#' className='hover:text-emerald-500 transition-colors'>
							API Docs
						</a>
					</div>
					<p className='text-gray-600 text-xs max-w-md text-right font-sans'>
						Past viral performance does not guarantee future results. Clipmil
						provides tools for content generation; execution depends on platform
						algorithms.
						<br />© 2025 Clipmil. All rights reserved.
					</p>
				</div>
			</footer>
		</div>
	);
}
