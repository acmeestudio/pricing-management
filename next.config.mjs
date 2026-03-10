/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["grammy", "pdf-parse"],
  },
  webpack: (config) => {
    // Evitar que webpack intente bundlear módulos nativos opcionales de pdfjs
    config.resolve.alias.canvas = false
    config.resolve.alias.encoding = false
    return config
  },
};

export default nextConfig;
