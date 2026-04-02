/** @type {import('next').NextConfig} */
const nextConfig = {
  // 本番ビルド最適化: standaloneモードでコンテナサイズ削減
  output: 'standalone',

  // A5: 画像最適化 - 許可するドメインを限定（不正利用防止）
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qrqr-dental.com',
      },
      {
        protocol: 'https',
        hostname: '*.qrqr-dental.com',
      },
    ],
  },

  // API Body Size Limit（画像アップロード用に10MBに設定）
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // セキュリティヘッダー
  // SLP連携: /shared/* はSLPドメインからのiframe表示を許可、それ以外は従来通りブロック
  async headers() {
    const SLP_DOMAIN = process.env.SLP_DOMAIN || 'https://smile-life-project.com';

    return [
      {
        // /shared/* 以外：既存のセキュリティヘッダーをそのまま維持
        source: '/((?!shared).*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), usb=(), geolocation=(self)',
          },
        ],
      },
      {
        // /shared/* のみ：SLPからのiframe埋め込みを許可
        source: '/shared/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors 'self' ${SLP_DOMAIN}`,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      {
        // /api/integration/* のみ：SLPからのCORSを許可
        source: '/api/integration/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: SLP_DOMAIN,
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'POST, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
