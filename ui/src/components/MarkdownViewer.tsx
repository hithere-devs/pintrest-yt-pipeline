import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, FileText } from 'lucide-react';

interface Props {
	content: string;
	title?: string;
	defaultExpanded?: boolean;
}

export default function MarkdownViewer({
	content,
	title = 'Raw Research Results',
	defaultExpanded = false,
}: Props) {
	const [expanded, setExpanded] = useState(defaultExpanded);
	const [copied, setCopied] = useState(false);

	const copyToClipboard = async () => {
		await navigator.clipboard.writeText(content);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	// Simple markdown-like rendering
	const renderContent = (text: string): ReactNode[] => {
		const lines = text.split('\n');
		const elements: ReactNode[] = [];
		let inCodeBlock = false;
		let codeContent: string[] = [];

		lines.forEach((line, index) => {
			// Code block handling
			if (line.startsWith('```')) {
				if (inCodeBlock) {
					elements.push(
						<pre
							key={`code-${index}`}
							className='bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm my-3 font-mono'
						>
							<code>{codeContent.join('\n')}</code>
						</pre>
					);
					codeContent = [];
					inCodeBlock = false;
				} else {
					inCodeBlock = true;
				}
				return;
			}

			if (inCodeBlock) {
				codeContent.push(line);
				return;
			}

			// Headers
			if (line.startsWith('### ')) {
				elements.push(
					<h4
						key={index}
						className='text-base font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2'
					>
						{line.slice(4)}
					</h4>
				);
				return;
			}
			if (line.startsWith('## ')) {
				elements.push(
					<h3
						key={index}
						className='text-lg font-bold text-gray-900 dark:text-white mt-5 mb-2'
					>
						{line.slice(3)}
					</h3>
				);
				return;
			}
			if (line.startsWith('# ')) {
				elements.push(
					<h2
						key={index}
						className='text-xl font-bold text-gray-900 dark:text-white mt-6 mb-3'
					>
						{line.slice(2)}
					</h2>
				);
				return;
			}

			// Bullet points
			if (line.startsWith('- ') || line.startsWith('* ')) {
				const bulletContent = line.slice(2);
				elements.push(
					<li
						key={index}
						className='ml-4 text-gray-700 dark:text-gray-300 text-sm list-disc'
					>
						{renderInlineFormatting(bulletContent)}
					</li>
				);
				return;
			}

			// Numbered lists
			const numberedMatch = line.match(/^(\d+)\.\s(.*)$/);
			if (numberedMatch) {
				elements.push(
					<li
						key={index}
						className='ml-4 text-gray-700 dark:text-gray-300 text-sm list-decimal'
					>
						{renderInlineFormatting(numberedMatch[2])}
					</li>
				);
				return;
			}

			// Empty lines
			if (line.trim() === '') {
				elements.push(<div key={index} className='h-2' />);
				return;
			}

			// Regular paragraph
			elements.push(
				<p
					key={index}
					className='text-gray-700 dark:text-gray-300 text-sm leading-relaxed'
				>
					{renderInlineFormatting(line)}
				</p>
			);
		});

		return elements;
	};

	// Render inline formatting (bold, italic, inline code)
	const renderInlineFormatting = (text: string): ReactNode => {
		// Simple replacement - just handle bold for now to keep it clean
		const boldParts = text.split(/\*\*(.*?)\*\*/g);
		return boldParts.map((part, i) => {
			if (i % 2 === 1) {
				return (
					<strong
						key={i}
						className='font-semibold text-gray-900 dark:text-white'
					>
						{part}
					</strong>
				);
			}
			// Handle inline code in non-bold parts
			const codeParts = part.split(/`(.*?)`/g);
			return codeParts.map((codePart, j) => {
				if (j % 2 === 1) {
					return (
						<code
							key={`${i}-${j}`}
							className='bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-coral text-xs font-mono'
						>
							{codePart}
						</code>
					);
				}
				return codePart;
			});
		});
	};

	return (
		<div className='border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden'>
			{/* Header - always visible */}
			<button
				onClick={() => setExpanded(!expanded)}
				className='w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-bg hover:bg-gray-100 dark:hover:bg-dark-border/50 transition-colors'
			>
				<div className='flex items-center gap-3'>
					{expanded ? (
						<ChevronDown size={18} className='text-coral' />
					) : (
						<ChevronRight size={18} className='text-gray-400' />
					)}
					<FileText size={18} className='text-coral' />
					<span className='font-medium text-gray-700 dark:text-gray-300'>
						{title}
					</span>
				</div>
				<span className='text-xs text-gray-400'>
					{expanded ? 'Click to collapse' : 'Click to expand'}
				</span>
			</button>

			{/* Expandable content */}
			{expanded && (
				<div className='border-t border-gray-200 dark:border-dark-border'>
					{/* Copy button */}
					<div className='flex justify-end p-2 bg-gray-50/50 dark:bg-dark-bg/50'>
						<button
							onClick={(e) => {
								e.stopPropagation();
								copyToClipboard();
							}}
							className='flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-coral hover:bg-gray-100 dark:hover:bg-dark-border rounded-lg transition-colors'
						>
							{copied ? (
								<>
									<Check size={14} />
									Copied!
								</>
							) : (
								<>
									<Copy size={14} />
									Copy All
								</>
							)}
						</button>
					</div>

					{/* Rendered content */}
					<div className='p-4 max-h-[500px] overflow-y-auto'>
						<div className='prose prose-sm dark:prose-invert max-w-none'>
							{renderContent(content)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
