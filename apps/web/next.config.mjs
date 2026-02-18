/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },
  webpack: (config) => {
    // konva/react-konva는 클라이언트 전용이므로
    // 서버 사이드에서 canvas 네이티브 모듈 요청을 무시
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    
    // symlink 해석 비활성화 (모듈 해석 안정성 향상)
    config.resolve.symlinks = false;
    
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: [],
  },
  // 개발 모드에서 더 안정적인 빌드
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default nextConfig;
