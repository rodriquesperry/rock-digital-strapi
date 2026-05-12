module.exports = ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  proxy: {
    koa: true,
  },
  url: env("PUBLIC_URL", "https://rockdigital.agency"),
  app: {
    keys: env.array("APP_KEYS"),
  },
  admin: {
    path: "/admin",
  },
});
