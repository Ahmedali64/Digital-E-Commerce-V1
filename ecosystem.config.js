export const apps = [
  {
    name: 'app-1',
    script: 'dist/src/main.js',
    instances: 1,
    env: {
      PORT: 3000,
      INSTANCE_ID: 'app-1',
    },
  },
  {
    name: 'app-2',
    script: 'dist/src/main.js',
    instances: 1,
    env: {
      PORT: 3001,
      INSTANCE_ID: 'app-2',
    },
  },
  {
    name: 'app-3',
    script: 'dist/src/main.js',
    instances: 1,
    env: {
      PORT: 3002,
      INSTANCE_ID: 'app-3',
    },
  },
  {
    name: 'app-4',
    script: 'dist/src/main.js',
    instances: 1,
    env: {
      PORT: 3003,
      INSTANCE_ID: 'app-4',
    },
  },
  {
    name: 'cron-worker',
    script: 'dist/src/corn-worker.js',
    args: 'all',
    cron_restart: '0 2 * * *', // Run daily at 2 AM
    autorestart: false,
  },
];
