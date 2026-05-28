const faviconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#2f5d50"/>
  <path d="M18 15h24l8 8v26H18z" fill="#f7f8f5"/>
  <path d="M42 15v10h10" fill="#cde5d5"/>
  <path d="M26 30h20M26 38h15M26 46h10" stroke="#2f5d50" stroke-width="4" stroke-linecap="round"/>
</svg>
`.trim();

export function GET() {
  return new Response(faviconSvg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
