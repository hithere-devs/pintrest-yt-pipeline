import { useState } from 'react';
import {
	ChevronLeft,
	ChevronRight,
	Calendar,
	Clock,
	Video,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '../components/ui/card';
import { Badge } from '../components/ui/badge';

// Dummy data for scheduled uploads
const scheduledUploads = [
	{
		id: 1,
		title: 'Morning Motivation Video',
		date: new Date(2025, 11, 15, 9, 0), // Dec 15, 2025, 9:00 AM
		platform: 'YouTube',
		status: 'scheduled',
		thumbnail: 'https://picsum.photos/seed/1/400/225',
	},
	{
		id: 2,
		title: 'Tutorial: Advanced Editing Techniques',
		date: new Date(2025, 11, 18, 14, 30), // Dec 18, 2025, 2:30 PM
		platform: 'YouTube',
		status: 'scheduled',
		thumbnail: 'https://picsum.photos/seed/2/400/225',
	},
	{
		id: 3,
		title: 'Product Review - Latest Tech',
		date: new Date(2025, 11, 20, 10, 0), // Dec 20, 2025, 10:00 AM
		platform: 'YouTube',
		status: 'scheduled',
		thumbnail: 'https://picsum.photos/seed/3/400/225',
	},
	{
		id: 4,
		title: 'Weekly Vlog #42',
		date: new Date(2025, 11, 22, 16, 0), // Dec 22, 2025, 4:00 PM
		platform: 'YouTube',
		status: 'scheduled',
		thumbnail: 'https://picsum.photos/seed/4/400/225',
	},
	{
		id: 5,
		title: 'Live Q&A Session',
		date: new Date(2025, 11, 25, 18, 0), // Dec 25, 2025, 6:00 PM
		platform: 'YouTube',
		status: 'scheduled',
		thumbnail: 'https://picsum.photos/seed/5/400/225',
	},
	{
		id: 6,
		title: 'Year End Special',
		date: new Date(2025, 11, 31, 12, 0), // Dec 31, 2025, 12:00 PM
		platform: 'YouTube',
		status: 'scheduled',
		thumbnail: 'https://picsum.photos/seed/6/400/225',
	},
];

export default function CalendarPage() {
	const [currentDate, setCurrentDate] = useState(new Date(2025, 11, 1)); // December 2025
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);

	const monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];

	const getDaysInMonth = (date: Date) => {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const daysInMonth = lastDay.getDate();
		const startingDayOfWeek = firstDay.getDay();

		return { daysInMonth, startingDayOfWeek };
	};

	const getUploadsForDate = (date: Date) => {
		return scheduledUploads.filter((upload) => {
			return (
				upload.date.getFullYear() === date.getFullYear() &&
				upload.date.getMonth() === date.getMonth() &&
				upload.date.getDate() === date.getDate()
			);
		});
	};

	const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);

	const previousMonth = () => {
		setCurrentDate(
			new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
		);
	};

	const nextMonth = () => {
		setCurrentDate(
			new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
		);
	};

	const handleDateClick = (day: number) => {
		const clickedDate = new Date(
			currentDate.getFullYear(),
			currentDate.getMonth(),
			day
		);
		setSelectedDate(clickedDate);
	};

	const selectedDateUploads = selectedDate
		? getUploadsForDate(selectedDate)
		: [];

	return (
		<div className='space-y-6'>
			{/* Header */}
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
						Content Calendar
					</h1>
					<p className='text-gray-500 dark:text-gray-400 mt-1'>
						Manage your scheduled uploads and content pipeline
					</p>
				</div>
				<Button className='bg-coral hover:bg-coral-dark text-white gap-2'>
					<Calendar size={18} />
					Schedule Upload
				</Button>
			</div>

			<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
				{/* Calendar View */}
				<Card className='lg:col-span-2'>
					<CardHeader>
						<div className='flex items-center justify-between'>
							<CardTitle className='text-2xl'>
								{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
							</CardTitle>
							<div className='flex gap-2'>
								<Button
									variant='outline'
									size='icon'
									onClick={previousMonth}
									className='rounded-full'
								>
									<ChevronLeft size={18} />
								</Button>
								<Button
									variant='outline'
									size='icon'
									onClick={nextMonth}
									className='rounded-full'
								>
									<ChevronRight size={18} />
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{/* Weekday Headers */}
						<div className='grid grid-cols-7 gap-2 mb-2'>
							{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
								<div
									key={day}
									className='text-center text-sm font-semibold text-gray-500 dark:text-gray-400 p-2'
								>
									{day}
								</div>
							))}
						</div>

						{/* Calendar Grid */}
						<div className='grid grid-cols-7 gap-2'>
							{/* Empty cells for days before month starts */}
							{Array.from({ length: startingDayOfWeek }).map((_, index) => (
								<div key={`empty-${index}`} className='aspect-square' />
							))}

							{/* Days of the month */}
							{Array.from({ length: daysInMonth }).map((_, index) => {
								const day = index + 1;
								const date = new Date(
									currentDate.getFullYear(),
									currentDate.getMonth(),
									day
								);
								const uploadsOnDay = getUploadsForDate(date);
								const isSelected =
									selectedDate &&
									selectedDate.getDate() === day &&
									selectedDate.getMonth() === currentDate.getMonth();
								const isToday =
									new Date().getDate() === day &&
									new Date().getMonth() === currentDate.getMonth() &&
									new Date().getFullYear() === currentDate.getFullYear();

								return (
									<button
										key={day}
										onClick={() => handleDateClick(day)}
										className={`aspect-square p-2 rounded-xl border transition-all ${
											isSelected
												? 'bg-coral text-white border-coral shadow-lg shadow-coral/20'
												: isToday
												? 'bg-coral/10 border-coral/30 text-coral font-semibold'
												: uploadsOnDay.length > 0
												? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30'
												: 'border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover'
										}`}
									>
										<div className='flex flex-col items-center justify-center h-full'>
											<span
												className={`text-sm ${
													isSelected || isToday ? 'font-bold' : 'font-medium'
												}`}
											>
												{day}
											</span>
											{uploadsOnDay.length > 0 && (
												<div className='flex gap-1 mt-1'>
													{uploadsOnDay.slice(0, 3).map((_, i) => (
														<div
															key={i}
															className={`w-1.5 h-1.5 rounded-full ${
																isSelected ? 'bg-white' : 'bg-coral'
															}`}
														/>
													))}
												</div>
											)}
										</div>
									</button>
								);
							})}
						</div>
					</CardContent>
				</Card>

				{/* Scheduled Uploads List */}
				<Card>
					<CardHeader>
						<CardTitle>
							{selectedDate
								? `Uploads on ${selectedDate.toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
								  })}`
								: 'All Scheduled Uploads'}
						</CardTitle>
						<CardDescription>
							{selectedDateUploads.length > 0
								? `${selectedDateUploads.length} upload${
										selectedDateUploads.length > 1 ? 's' : ''
								  } scheduled`
								: selectedDate
								? 'No uploads scheduled'
								: `${scheduledUploads.length} total uploads`}
						</CardDescription>
					</CardHeader>
					<CardContent className='space-y-3 max-h-[600px] overflow-y-auto'>
						{(selectedDateUploads.length > 0
							? selectedDateUploads
							: scheduledUploads
						).map((upload) => (
							<div
								key={upload.id}
								className='p-3 rounded-xl border border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors'
							>
								<div className='flex gap-3'>
									<img
										src={upload.thumbnail}
										alt={upload.title}
										className='w-20 h-12 object-cover rounded-lg'
									/>
									<div className='flex-1 min-w-0'>
										<h4 className='text-sm font-semibold text-gray-900 dark:text-white truncate'>
											{upload.title}
										</h4>
										<div className='flex items-center gap-2 mt-1'>
											<Clock size={12} className='text-gray-400' />
											<span className='text-xs text-gray-500 dark:text-gray-400'>
												{upload.date.toLocaleString('en-US', {
													month: 'short',
													day: 'numeric',
													hour: 'numeric',
													minute: '2-digit',
												})}
											</span>
										</div>
										<Badge
											variant='secondary'
											className='mt-2 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
										>
											<Video size={10} className='mr-1' />
											{upload.platform}
										</Badge>
									</div>
								</div>
							</div>
						))}
					</CardContent>
				</Card>
			</div>

			{/* Upcoming This Week */}
			<Card>
				<CardHeader>
					<CardTitle>Upcoming This Week</CardTitle>
					<CardDescription>
						Quick view of your scheduled content for the next 7 days
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
						{scheduledUploads.slice(0, 3).map((upload) => (
							<div
								key={upload.id}
								className='p-4 rounded-xl border border-gray-100 dark:border-dark-border hover:shadow-md transition-shadow'
							>
								<img
									src={upload.thumbnail}
									alt={upload.title}
									className='w-full h-32 object-cover rounded-lg mb-3'
								/>
								<h4 className='font-semibold text-gray-900 dark:text-white mb-2'>
									{upload.title}
								</h4>
								<div className='flex items-center justify-between'>
									<div className='flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400'>
										<Clock size={14} />
										<span>
											{upload.date.toLocaleString('en-US', {
												month: 'short',
												day: 'numeric',
												hour: 'numeric',
												minute: '2-digit',
											})}
										</span>
									</div>
									<Badge
										variant='secondary'
										className='bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
									>
										{upload.status}
									</Badge>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
