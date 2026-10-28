/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdfjs-dist optionally requires the native "canvas" package for Node; the browser build never needs it.
    config.resolve.alias.canvas = false;
    return config;
  },
};
export default nextConfig;
