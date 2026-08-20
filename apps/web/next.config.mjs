import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The static mockup at repo root is still the deployed surface (AGENTS.md
  // source priority 1). This app is built and deployed separately until the
  // Vocabulary vertical slice replaces the mockup route. fileURLToPath (not
  // URL.pathname) so the root resolves on Windows too.
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
};

export default nextConfig;
