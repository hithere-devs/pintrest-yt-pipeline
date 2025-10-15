module.exports = {
	apps: [
		{
			name: 'pinterest-youtube-pipeline',
			script: './dist/index.js',
			instances: 1,
			exec_mode: 'fork',
			autorestart: true,
			watch: false,
			max_memory_restart: '500M',
			env: {
				NODE_ENV: 'production',
				PORT: 4000,
			},
			error_file: './logs/pm2-error.log',
			out_file: './logs/pm2-out.log',
			log_file: './logs/pm2-combined.log',
			time: true,
			merge_logs: true,
			log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

			// Restart strategies
			min_uptime: '10s',
			max_restarts: 10,
			restart_delay: 4000,

			// Stop grace period
			kill_timeout: 5000,
			wait_ready: false,
			listen_timeout: 3000,

			// Advanced features
			instance_var: 'INSTANCE_ID',

			// Cron restart (optional - restart daily at 3 AM)
			cron_restart: '0 3 * * *',

			// Post-deploy hooks (optional)
			post_update: ['npm install', 'npm run build'],
		},
	],
};
