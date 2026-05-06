'use strict';

const POSTS_TABLE = 'posts';

const createParagraphBlocks = (text = '') => [
  {
    type: 'paragraph',
    children: [
      {
        type: 'text',
        text,
      },
    ],
  },
];

const isBlocksValue = (value) =>
  Array.isArray(value) &&
  value.every(
    (block) =>
      block &&
      typeof block === 'object' &&
      typeof block.type === 'string' &&
      Array.isArray(block.children),
  );

const normalizePostBodyToBlocks = (value) => {
  if (value == null) {
    return null;
  }

  if (isBlocksValue(value)) {
    return value;
  }

  if (typeof value === 'string') {
    if (value.trim() === '') {
      return createParagraphBlocks('');
    }

    try {
      const parsed = JSON.parse(value);

      if (isBlocksValue(parsed)) {
        return parsed;
      }

      if (typeof parsed === 'string') {
        return createParagraphBlocks(parsed);
      }

      return createParagraphBlocks(JSON.stringify(parsed, null, 2));
    } catch (_error) {
      return createParagraphBlocks(value);
    }
  }

  if (typeof value === 'object') {
    return createParagraphBlocks(JSON.stringify(value, null, 2));
  }

  return createParagraphBlocks(String(value));
};

const migratePostBodyFieldToBlocks = async (strapi) => {
  const knex = strapi.db?.connection;

  if (!knex) {
    return;
  }

  const hasPostsTable = await knex.schema.hasTable(POSTS_TABLE);

  if (!hasPostsTable) {
    return;
  }

  const columns = await knex(POSTS_TABLE).columnInfo();

  if (!columns.body) {
    return;
  }

  const rows = await knex(POSTS_TABLE).select('id', 'body');
  const updates = [];

  for (const row of rows) {
    if (row.body == null) {
      continue;
    }

    const normalizedBlocks = normalizePostBodyToBlocks(row.body);
    const normalizedValue = JSON.stringify(normalizedBlocks);

    if (row.body !== normalizedValue) {
      updates.push({
        id: row.id,
        body: normalizedValue,
      });
    }
  }

  if (updates.length === 0) {
    return;
  }

  await knex.transaction(async (trx) => {
    for (const update of updates) {
      await trx(POSTS_TABLE).where({ id: update.id }).update({ body: update.body });
    }
  });

  strapi.log.info(
    `Migrated ${updates.length} post body value(s) to Strapi blocks format before schema sync.`,
  );
};

const logUploadProvider = (strapi) => {
  const uploadConfig = strapi.config.get('plugin::upload') || {};
  const providerOptions = uploadConfig.providerOptions || {};
  const s3Options = providerOptions.s3Options || {};
  const bucket = s3Options.params?.Bucket;

  strapi.log.info(
    `Upload provider: ${uploadConfig.provider || 'local'}${
      bucket ? ` bucket=${bucket}` : ''
    }${s3Options.endpoint ? ` endpoint=${s3Options.endpoint}` : ''}${
      providerOptions.baseUrl ? ` baseUrl=${providerOptions.baseUrl}` : ''
    }`,
  );
};

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    strapi.hook('strapi::content-types.beforeSync').register(async () => {
      await migratePostBodyFieldToBlocks(strapi);
    });
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }) {
    logUploadProvider(strapi);
  },
};
