/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  distDir: "output",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
