import type { NextConfig } from "next";

// No incluye Content-Security-Policy: la app embebe Google Docs/Sheets/Slides
// en iframes propios, usa Supabase realtime, Gemini y fuentes/scripts inline
// de Next.js — una CSP mal calibrada rompería esas integraciones y no hay
// forma de verificarlo en este entorno sin acceso a navegador. El resto de
// headers de abajo no tiene ese riesgo: no cambian qué carga la app, solo
// cómo el navegador la trata.
const securityHeaders = [
  // Evita que Project Hub sea embebido en un <iframe> de otro sitio
  // (clickjacking). No afecta que la app embeba Google Docs/Sheets/Slides:
  // esa dirección (nosotros embebiendo a Google) es independiente de esta
  // (otros embebiéndonos a nosotros).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Impide que el navegador "adivine" el tipo de un archivo servido con un
  // Content-Type distinto al real (p. ej. un avatar subido con MIME
  // spoofeado que en realidad es HTML/SVG con script embebido).
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La app no usa cámara, micrófono, geolocalización ni cobros in-browser.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
