import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  // pdf.js polyfills DOMMatrix via @napi-rs/canvas, loaded with a dynamic
  // require that file tracing misses — without this the serverless bundle
  // ships without it and /api/audit dies with "DOMMatrix is not defined".
  outputFileTracingIncludes: {
    "/api/audit": [
      "./node_modules/@napi-rs/**",
      "./node_modules/pdf-parse/**",
      "./node_modules/pdfjs-dist/**",
    ],
  },
};

export default nextConfig;
