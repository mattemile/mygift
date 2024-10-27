/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
          {
            protocol: "https", // or http
            hostname: "s3.amazonaws.com", // if your website has no www, drop it
          },
          {
            protocol: "https", // or http
            hostname: "cdn.deporvillage.com", // if your website has no www, drop it
          },
          {
            protocol: "https", // or http
            hostname: "*", // if your website has no www, drop it
          },
        ],
      },
    };

module.exports = nextConfig;
