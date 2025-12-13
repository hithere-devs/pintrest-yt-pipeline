import React, { useEffect, useState } from 'react';
import type { DashboardData } from './types';

const API_BASE = 'http://localhost:4000';

export default function Dashboard() {
	const [data, setData] = useState<DashboardData | null>(null);
	const [newUrl, setNewUrl] = useState('');
	const [loading, setLoading] = useState(false);

	const fetchData = async () => {
		try {
			const res = await fetch(`${API_BASE}/queue`);
			const json = await res.json();
			setData(json);
		} catch (err) {
			console.error(err);
		}
	};

	useEffect(() => {
		fetchData();
		const interval = setInterval(fetchData, 5000);
		return () => clearInterval(interval);
	}, []);

	const addUrl = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newUrl) return;
		await fetch(`${API_BASE}/queue/add`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: newUrl }),
		});
		setNewUrl('');
		fetchData();
	};

	const removeUrl = async (index: number) => {
		await fetch(`${API_BASE}/queue/${index}`, { method: 'DELETE' });
		fetchData();
	};

	const triggerDownload = async () => {
		setLoading(true);
		await fetch(`${API_BASE}/trigger-download`);
		setLoading(false);
		fetchData();
	};

	if (!data) return <div className='p-8'>Loading...</div>;

	return (
		<div className='min-h-screen bg-gray-100 p-8'>
			<div className='max-w-4xl mx-auto'>
				<header className='flex justify-between items-center mb-8'>
					<h1 className='text-3xl font-bold text-gray-800'>
						Pinterest Pipeline
					</h1>
					<div className='flex items-center gap-4'>
						<div className='text-sm text-gray-600'>
							Last Run:{' '}
							{data.lastJobResult.ranAt
								? new Date(data.lastJobResult.ranAt).toLocaleString()
								: 'Never'}
							<span
								className={`ml-2 px-2 py-1 rounded text-xs ${
									data.lastJobResult.status === 'failed'
										? 'bg-red-100 text-red-800'
										: 'bg-green-100 text-green-800'
								}`}
							>
								{data.lastJobResult.status}
							</span>
						</div>
						<button
							onClick={triggerDownload}
							disabled={loading}
							className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50'
						>
							{loading ? 'Running...' : 'Trigger Now'}
						</button>
					</div>
				</header>

				<div className='grid gap-6'>
					{/* Queue Section */}
					<div className='bg-white rounded-lg shadow p-6'>
						<h2 className='text-xl font-semibold mb-4'>
							Download Queue ({data.videoLinks.length})
						</h2>

						<form onSubmit={addUrl} className='flex gap-2 mb-4'>
							<input
								type='text'
								value={newUrl}
								onChange={(e) => setNewUrl(e.target.value)}
								placeholder='Paste Pinterest URL...'
								className='flex-1 border rounded px-3 py-2'
							/>
							<button
								type='submit'
								className='bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700'
							>
								Add
							</button>
						</form>

						<ul className='divide-y'>
							{data.videoLinks.map((link, i) => (
								<li key={i} className='py-3 flex justify-between items-center'>
									<a
										href={link}
										target='_blank'
										rel='noreferrer'
										className='text-blue-600 hover:underline truncate max-w-xl'
									>
										{link}
									</a>
									<button
										onClick={() => removeUrl(i)}
										className='text-red-500 hover:text-red-700'
									>
										Remove
									</button>
								</li>
							))}
							{data.videoLinks.length === 0 && (
								<li className='text-gray-500 italic py-2'>Queue is empty</li>
							)}
						</ul>
					</div>

					{/* History Section */}
					<div className='bg-white rounded-lg shadow p-6'>
						<h2 className='text-xl font-semibold mb-4'>Processed History</h2>
						<div className='overflow-x-auto'>
							<table className='w-full text-left'>
								<thead>
									<tr className='border-b'>
										<th className='pb-2'>Date</th>
										<th className='pb-2'>Source</th>
										<th className='pb-2'>YouTube</th>
									</tr>
								</thead>
								<tbody className='divide-y'>
									{data.videosProcessed
										.slice()
										.reverse()
										.map((entry, i) => {
											const isString = typeof entry === 'string';
											const url = isString ? entry : entry.url;
											const date = isString
												? 'Unknown'
												: new Date(entry.downloadedAt).toLocaleDateString();
											const yt = !isString && entry.youtube;

											return (
												<tr key={i}>
													<td className='py-3 text-sm text-gray-600'>{date}</td>
													<td className='py-3'>
														<a
															href={url}
															target='_blank'
															rel='noreferrer'
															className='text-blue-600 hover:underline text-sm block max-w-xs truncate'
														>
															{url}
														</a>
													</td>
													<td className='py-3'>
														{yt ? (
															<a
																href={yt.videoUrl}
																target='_blank'
																rel='noreferrer'
																className='text-red-600 hover:underline text-sm flex items-center gap-1'
															>
																<span className='w-2 h-2 bg-green-500 rounded-full'></span>
																{yt.title}
															</a>
														) : (
															<span className='text-gray-400 text-sm'>
																Not uploaded
															</span>
														)}
													</td>
												</tr>
											);
										})}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
