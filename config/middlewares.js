const normalizeUrl = (value) => {
  if (!value) {
    return undefined;
  }

  return value.trim().replace(/\/+$/, "");
};

const toOrigin = (value) => {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).origin;
  } catch (error) {
    return undefined;
  }
};

const getRegionFromEndpoint = (endpoint) => {
  const match = endpoint?.match(
    /^https?:\/\/([a-z0-9-]+)\.digitaloceanspaces\.com/i,
  );

  return match?.[1];
};

const normalizeSpacesRegion = (value) => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  const appPlatformRegionMatch = normalized.match(/^us-([a-z]{3}\d)$/);

  return appPlatformRegionMatch?.[1] ?? normalized;
};

const getMediaSources = (env) => {
  const bucket = env("SPACES_BUCKET");
  const endpoint = normalizeUrl(env("SPACES_ENDPOINT"));
  const region = normalizeSpacesRegion(
    getRegionFromEndpoint(endpoint) ?? env("SPACES_REGION"),
  );
  const sources = new Set(["'self'", "data:", "blob:", "dl.airtable.com"]);

  [
    env("SPACES_BASE_URL"),
    endpoint,
    bucket && region
      ? `https://${bucket}.${region}.digitaloceanspaces.com`
      : undefined,
  ]
    .map(normalizeUrl)
    .map(toOrigin)
    .filter(Boolean)
    .forEach((origin) => {
      sources.add(origin);
    });

  return Array.from(sources);
};

module.exports = ({ env }) => [
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "img-src": getMediaSources(env),
          "media-src": getMediaSources(env),
        },
      },
    },
  },
  "strapi::poweredBy",
  {
    name: "strapi::cors",
    config: {
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      headers: ["Content-Type", "Authorization", "Origin", "Accept"],
      origin: [
        "http://localhost:3000", // Frontend running locally
        "http://localhost:3001", // Alternative local frontend
        "http://127.0.0.1:1337", // Local Strapi instance
        "https://rockdigital.agency", // Your live site
        "https://www.rockdigital.agency", // Live site
        "https://rockdigital-v2-3ynnuk96o-rodriques-projects.vercel.app", // Vercel frontend
        "*", // Allow any origin (use cautiously, only for development)
      ],
    },
  },
  "strapi::logger",
  "strapi::query",
  {
    name: "strapi::body",
    config: {
      formLimit: "256mb", // Modify form body
      jsonLimit: "256mb", // Modify JSON body
      textLimit: "256mb", // Modify text body
      formidable: {
        maxFileSize: 250 * 1024 * 1024, // Multipart data, modify here the limit of uploaded file size
      },
    },
  },
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
];
