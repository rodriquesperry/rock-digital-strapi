"use strict";

const normalizeUrl = (value) => {
  if (!value) {
    return undefined;
  }

  return value.trim().replace(/\/+$/, "");
};

module.exports = ({ env }) => {
  const bucket = env("SPACES_BUCKET");

  if (!bucket) {
    return {};
  }

  return {
    upload: {
      config: {
        provider: "aws-s3",
        providerOptions: {
          baseUrl: normalizeUrl(env("SPACES_BASE_URL")),
          rootPath: env("SPACES_ROOT_PATH", "uploads"),
          s3Options: {
            credentials: {
              accessKeyId: env("SPACES_ACCESS_KEY_ID"),
              secretAccessKey: env("SPACES_SECRET_ACCESS_KEY"),
            },
            endpoint: normalizeUrl(env("SPACES_ENDPOINT")),
            region: env("SPACES_REGION"),
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
