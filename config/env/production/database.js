const fs = require("fs");

// module.exports = ({ env }) => ({
//   return {
//   connection: {
//     client: "mysql",
//     connection: {
//       host: env("DATABASE_HOST"),
//       port: env.int("DATABASE_PORT"),
//       database: env("DATABASE_NAME"),
//       user: env("DATABASE_USERNAME"),
//       password: env("DATABASE_PASSWORD"),
//       connectTimeout: 10000,
//       ssl: {
//         ca: fs.readFileSync(
//           "/Volumes/Rods Hard Drive/Rock Digital/ca-certificate.crt",
//         ),
//         rejectUnauthorized: env.bool("DATABASE_SSL_SELF", true), // Use true for secure connections
//       },
//     },
//     debug: false,
//   },
// }
// });

module.exports = ({ env }) => {
  return {
    connection: {
      client: "mysql",
      connection: {
        host: env("DATABASE_HOST"),
        port: env.int("DATABASE_PORT"),
        database: env("DATABASE_NAME"),
        user: env("DATABASE_USERNAME"),
        password: env("DATABASE_PASSWORD"),
        connectTimeout: 10000,
        ssl: {
          ca: fs.readFileSync(env("DATABASE_CA_PATH"), "utf8"),
          rejectUnauthorized: env.bool("DATABASE_SSL_SELF", true), // Use true for secure connections
        },
      },
      debug: true,
    },
  };
};
