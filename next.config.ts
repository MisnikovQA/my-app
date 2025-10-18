// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only affects DEV server; production is fine.
  allowedDevOrigins: [
    'http://192.168.1.25:3000', // your LAN origin
    'http://localhost:3000'
  ],
};
export default nextConfig;