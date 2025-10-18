module.exports = {
  apps: [
    {
      name: "my-app",
      cwd: "/home/mqas/my-app",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      },
      max_restarts: 10,
      restart_delay: 2000
    }
  ]
};
