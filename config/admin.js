const getPreviewPathname = (uid, document) => {
  if (uid !== "api::post.post") {
    return null;
  }

  if (!document?.slug) {
    return "/blog";
  }

  return `/blog/${document.slug}`;
};

module.exports = ({ env }) => {
  const clientUrl = env("CLIENT_URL", "http://localhost:3000").replace(/\/$/, "");
  const previewSecret = env("PREVIEW_SECRET");

  return {
    auth: {
      secret: env("ADMIN_JWT_SECRET"),
    },
    apiToken: {
      salt: env("API_TOKEN_SALT"),
    },
    transfer: {
      token: {
        salt: env("TRANSFER_TOKEN_SALT"),
      },
    },
    preview: {
      enabled: true,
      config: {
        allowedOrigins: clientUrl,
        async handler(uid, { documentId, status }) {
          const document = await strapi.documents(uid).findOne({
            documentId,
            status: status === "published" ? "published" : "draft",
          });
          const pathname = getPreviewPathname(uid, document);

          if (!pathname) {
            return null;
          }

          const urlSearchParams = new URLSearchParams({
            url: pathname,
            secret: previewSecret,
            status,
          });

          return `${clientUrl}/api/preview?${urlSearchParams}`;
        },
      },
    },
  };
};
