"use strict";

const fs = require("fs");
const path = require("path");
const { compileStrapi, createStrapi } = require("@strapi/core");

const FILE_MODEL_UID = "plugin::upload.file";
const LOCAL_UPLOADS_URL_PREFIX = "/uploads/";
const LOCAL_UPLOADS_DIR = path.resolve(process.cwd(), "public/uploads");

const isAbsoluteUrl = (value) => /^\w+:\/\//.test(value);

const startsWithLocalUploadUrl = (value) =>
  typeof value === "string" && value.startsWith(LOCAL_UPLOADS_URL_PREFIX);

const buildCandidatePaths = (asset) => {
  const candidates = [];

  if (startsWithLocalUploadUrl(asset?.url)) {
    candidates.push(
      path.join(
        LOCAL_UPLOADS_DIR,
        decodeURIComponent(asset.url.slice(LOCAL_UPLOADS_URL_PREFIX.length)),
      ),
    );
  }

  if (asset?.hash && asset?.ext) {
    candidates.push(path.join(LOCAL_UPLOADS_DIR, `${asset.hash}${asset.ext}`));
  }

  if (asset?.name) {
    candidates.push(path.join(LOCAL_UPLOADS_DIR, asset.name));
  }

  return [...new Set(candidates)];
};

const resolveLocalFilePath = (asset) =>
  buildCandidatePaths(asset).find((candidate) => fs.existsSync(candidate));

const buildUploadPayload = (asset, filepath) => ({
  name: asset.name,
  alternativeText: asset.alternativeText,
  caption: asset.caption,
  width: asset.width,
  height: asset.height,
  formats: asset.formats,
  hash: asset.hash,
  ext: asset.ext,
  mime: asset.mime,
  size: asset.size,
  path: asset.path,
  provider_metadata: asset.provider_metadata,
  filepath,
  getStream: () => fs.createReadStream(filepath),
});

const shouldSkipFile = (file, targetProvider) => {
  if (!file?.url) {
    return false;
  }

  if (startsWithLocalUploadUrl(file.url)) {
    return false;
  }

  if (!isAbsoluteUrl(file.url)) {
    return false;
  }

  return file.provider === targetProvider;
};

const uploadAsset = async (providerService, asset, filepath) => {
  const uploadPayload = buildUploadPayload(asset, filepath);

  await providerService.upload(uploadPayload);

  return uploadPayload;
};

const migrateFormats = async (providerService, formats) => {
  if (!formats || typeof formats !== "object") {
    return formats;
  }

  const migratedFormats = { ...formats };

  for (const [key, formatAsset] of Object.entries(formats)) {
    const localPath = resolveLocalFilePath(formatAsset);

    if (!localPath) {
      console.warn(
        `[warn] Missing local format file for "${key}" (${formatAsset?.url ?? "no url"}). Keeping the current value.`,
      );
      continue;
    }

    const uploadedFormat = await uploadAsset(providerService, formatAsset, localPath);

    migratedFormats[key] = {
      ...formatAsset,
      url: uploadedFormat.url,
      provider_metadata:
        uploadedFormat.provider_metadata ?? formatAsset.provider_metadata ?? null,
    };
  }

  return migratedFormats;
};

const createStrapiInstance = async () => {
  const appContext = await compileStrapi();
  const app = createStrapi(appContext);
  app.log.level = "info";
  return app.load();
};

const main = async () => {
  let strapi;

  try {
    if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
      throw new Error(
        `Local uploads directory was not found at ${LOCAL_UPLOADS_DIR}.`,
      );
    }

    strapi = await createStrapiInstance();

    const uploadConfig = strapi.config.get("plugin::upload");
    const targetProvider = uploadConfig?.provider;

    if (targetProvider !== "aws-s3") {
      throw new Error(
        "Spaces upload provider is not active. Set SPACES_* environment variables before running this migration.",
      );
    }

    const files = await strapi.db
      .query(FILE_MODEL_UID)
      .findMany({ orderBy: { id: "asc" } });

    const providerService = strapi.plugin("upload").service("provider");
    const counters = {
      total: files.length,
      migrated: 0,
      skippedRemote: 0,
      skippedMissing: 0,
      failed: 0,
    };

    for (const file of files) {
      if (shouldSkipFile(file, targetProvider)) {
        counters.skippedRemote += 1;
        console.log(`[skip] #${file.id} already points at ${targetProvider}.`);
        continue;
      }

      const localPath = resolveLocalFilePath(file);

      if (!localPath) {
        counters.skippedMissing += 1;
        console.warn(
          `[warn] Missing local source for #${file.id} "${file.name}" (${file.url ?? "no url"}).`,
        );
        continue;
      }

      try {
        const uploadedFile = await uploadAsset(providerService, file, localPath);
        const formats = await migrateFormats(providerService, file.formats);

        await strapi.db.query(FILE_MODEL_UID).update({
          where: { id: file.id },
          data: {
            provider: targetProvider,
            provider_metadata:
              uploadedFile.provider_metadata ?? file.provider_metadata ?? null,
            url: uploadedFile.url,
            formats,
          },
        });

        counters.migrated += 1;
        console.log(`[ok] Migrated #${file.id} "${file.name}" to ${uploadedFile.url}`);
      } catch (error) {
        counters.failed += 1;
        console.error(
          `[error] Failed migrating #${file.id} "${file.name}": ${error.message}`,
        );
      }
    }

    console.log("");
    console.log("Migration summary");
    console.log(`  Total files: ${counters.total}`);
    console.log(`  Migrated: ${counters.migrated}`);
    console.log(`  Skipped (already remote): ${counters.skippedRemote}`);
    console.log(`  Skipped (missing local file): ${counters.skippedMissing}`);
    console.log(`  Failed: ${counters.failed}`);
  } finally {
    if (strapi) {
      await strapi.destroy();
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
