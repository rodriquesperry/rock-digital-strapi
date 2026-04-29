"use strict";

const normalizeUrl = (value) => {
  if (!value) {
    return undefined;
  }

  return value.trim().replace(/\/+$/, "");
};

const firstEnv = (env, names, fallback) => {
  for (const name of names) {
    const value = env(name);

    if (value) {
      return value;
    }
  }

  return fallback;
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

const requireSpacesEnv = (values) => {
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `DigitalOcean Spaces upload provider is enabled, but these required values are missing: ${missing.join(
        ", ",
      )}.`,
    );
  }
};

module.exports = ({ env }) => {
  const bucket = env("SPACES_BUCKET");
  const accessKeyId = firstEnv(env, [
    "SPACES_ACCESS_KEY_ID",
    "SPACES_ACCESS_KEY",
    "AWS_ACCESS_KEY_ID",
  ]);
  const secretAccessKey = firstEnv(env, [
    "SPACES_SECRET_ACCESS_KEY",
    "SPACES_SECRET_KEY",
    "AWS_SECRET_ACCESS_KEY",
  ]);
  const configuredEndpoint = normalizeUrl(env("SPACES_ENDPOINT"));
  const spacesRegion = normalizeSpacesRegion(
    getRegionFromEndpoint(configuredEndpoint) ?? env("SPACES_REGION"),
  );
  const endpoint =
    configuredEndpoint ||
    (spacesRegion && `https://${spacesRegion}.digitaloceanspaces.com`);
  const baseUrl = normalizeUrl(
    env(
      "SPACES_BASE_URL",
      bucket && spacesRegion
        ? `https://${bucket}.${spacesRegion}.digitaloceanspaces.com`
        : undefined,
    ),
  );
  const signingRegion = env(
    "SPACES_SIGNING_REGION",
    env("AWS_REGION", "us-east-1"),
  );

  if (!bucket) {
    return {};
  }

  requireSpacesEnv({
    SPACES_BUCKET: bucket,
    SPACES_REGION_OR_ENDPOINT: spacesRegion,
    SPACES_ACCESS_KEY: accessKeyId,
    SPACES_SECRET_KEY: secretAccessKey,
    SPACES_ENDPOINT: endpoint,
  });

  return {
    upload: {
      config: {
        provider: "aws-s3",
        providerOptions: {
          baseUrl,
          rootPath: env("SPACES_ROOT_PATH", "uploads"),
          s3Options: {
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
            endpoint,
            region: signingRegion,
            params: {
              ACL: env("SPACES_ACL", "public-read"),
              signedUrlExpires: env.int("SPACES_SIGNED_URL_EXPIRES", 15 * 60),
              Bucket: bucket,
              CacheControl: env(
                "SPACES_CACHE_CONTROL",
                "public, max-age=31536000, immutable",
              ),
            },
          },
        },
        actionOptions: {
          upload: {},
          uploadStream: {},
          delete: {},
        },
      },
    },
  };
};
