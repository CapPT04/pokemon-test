/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable experimental features if needed
    experimental: {
        // Add any experimental features here if needed
    },
    // Set output option for build
    output: 'standalone',
    // Add environment variables
    env: {
        NEXT_PHASE: process.env.NEXT_PHASE || 'phase-production-build',
    },
};

module.exports = nextConfig;
