/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Lejon testet të ndërtojnë te .next-test pa ia prishur output-in `npm run dev`,
  // që të dyja të mund të punojnë njëkohësisht. Shih tests/README.md.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Rrugët e vjetra /dashboard/* u sheshuan në rrënjë. Këto ridrejtime mbajnë
  // gjallë linqet e ruajtura dhe faqerojtësit e pronarëve.
  async redirects() {
    return [
      { source: "/dashboard/services", destination: "/services", permanent: false },
      { source: "/dashboard/settings", destination: "/settings", permanent: false },
      { source: "/dashboard/setup", destination: "/setup", permanent: false },
    ];
  },
};

export default nextConfig;
