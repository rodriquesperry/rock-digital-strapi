const fs = require("fs");
const path = require("path");

const resolveCertificatePath = (certificatePath) =>
  path.isAbsolute(certificatePath)
    ? certificatePath
    : path.resolve(process.cwd(), certificatePath);

const getSslConfig = (env) => {
  if (!env.bool("DATABASE_SSL", false)) {
    return false;
  }

  const ssl = {
    rejectUnauthorized: env.bool(
      "DATABASE_SSL_REJECT_UNAUTHORIZED",
      !env.bool("DATABASE_SSL_SELF", false),
    ),
  };

  const caCertificateBase64 = env("CA_CERT_BASE64");
  const caCertificateEnvPath = env("DATABASE_CA_PATH");

  if (caCertificateBase64) {
    const certificatePath = resolveCertificatePath(
      caCertificateEnvPath || "config/ssl/ca-certificate.crt",
    );
    fs.mkdirSync(path.dirname(certificatePath), { recursive: true });
    fs.writeFileSync(
      certificatePath,
      Buffer.from(caCertificateBase64, "base64"),
    );
    ssl.ca = fs.readFileSync(certificatePath, "utf8");
  } else if (caCertificateEnvPath) {
    ssl.ca = fs.readFileSync(
      resolveCertificatePath(caCertificateEnvPath),
      "utf8",
    );
  }

  return ssl;
};

module.exports = ({ env }) => {
  return {
    connection: {
      client: env("DATABASE_CLIENT", "mysql"),
      connection: {
        host: env("DATABASE_HOST", "127.0.0.1"),
        port: env.int("DATABASE_PORT", 3306),
        database: env("DATABASE_NAME", "strapi"),
        user: env("DATABASE_USERNAME", "root"),
        password: env("DATABASE_PASSWORD", ""),
        connectTimeout: 10000,
        ssl: getSslConfig(env),
      },
    },
  };
};
