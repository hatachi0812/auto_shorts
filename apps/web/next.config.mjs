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
    return config;
  },
};

export default nextConfig;
