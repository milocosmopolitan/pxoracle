import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'export', trailingSlash: true, images: { unoptimized: true },
  transpilePackages: ['@pxoracle/contracts','@pxoracle/engine-client','@pxoracle/scene-runtime','@pxoracle/scenes'],
};
export default config;
