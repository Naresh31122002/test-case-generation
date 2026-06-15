/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://testsurge.kynetropo.com",
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    additionalSitemaps: [
      "https://testsurge.kynetropo.com/sitemap.xml",
    ],
  },
};
