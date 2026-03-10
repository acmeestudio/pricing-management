/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["grammy", "pdfjs-dist", "pdf-parse"],
  },
};

export default nextConfig;
