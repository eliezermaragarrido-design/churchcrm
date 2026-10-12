/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/assistant/grace-hope": ["./lib/documents/templates/grace-hope-template.docx"],
    "/api/assistant/grace-hope/*/download": ["./lib/documents/templates/grace-hope-template.docx"],
  },
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
