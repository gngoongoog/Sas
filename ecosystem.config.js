module.exports = {
  apps: [
    {
      name: 'supersas',
      script: 'server.ts',
      interpreter: 'tsx',
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: '3000'
      }
    }
  ]
};
