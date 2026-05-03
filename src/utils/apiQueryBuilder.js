const { QUERY_CONFIG } = require("../config/query-config");

const toNumberIfNumeric = (v) => (v !== "" && !isNaN(v) ? Number(v) : v);

/**
 * Build Prisma query: where, orderBy, include/select, pagination
 */
const buildQuery = (model, query) => {
  const config = QUERY_CONFIG[model];
  if (!config) throw new Error(`No query config for model: ${model}`);

  // ---------- Pagination ----------
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 10, 100);
  const skip = (page - 1) * limit;
  const take = limit;

  // ---------- WHERE (safe) ----------
  const where = {};
  const exclude = ["page", "limit", "sort", "search", "fields", "include"];

  Object.keys(query).forEach((key) => {
    if (exclude.includes(key)) return;

    const value = query[key];

    // relation.field
    if (key.includes(".")) {
      const [relation, field] = key.split(".");

      if (
        config.relations?.[relation] &&
        config.relations[relation].fields.includes(field)
      ) {
        where[relation] = {
          ...(where[relation] || {}),
          [field]: { contains: value, mode: "insensitive" },
        };
      }
      return;
    }

    // root field
    const match = key.match(/^(.+)\[(.+)\]$/);

    if (match) {
      const field = match[1];
      const op = match[2];

      if (!config.allowedFilters.includes(field)) return;

      if (!where[field]) where[field] = {};

      switch (op) {
        case "gte":
        case "lte":
        case "gt":
        case "lt":
          where[field][op] = toNumberIfNumeric(value);
          break;
        case "contains":
          where[field].contains = value;
          where[field].mode = "insensitive";
          break;
        case "in":
          where[field].in = value.split(",");
          break;
        case "not":
          where[field].not = value;
          break;
        default:
          break;
      }
    } else {
      if (!config.allowedFilters.includes(key)) return;
      where[key] = toNumberIfNumeric(value);
    }
  });

  // ---------- SEARCH ----------
  if (query.search && config.searchFields?.length) {
    where.OR = config.searchFields.map((f) => ({
      [f]: { contains: query.search, mode: "insensitive" },
    }));
  }

  // ---------- SORT (root + relation) ----------
  let orderBy;
  if (query.sort) {
    const parts = query.sort.split(",");

    orderBy = parts
      .map((p) => {
        let dir = "asc";
        let field = p;

        if (p.startsWith("-")) {
          dir = "desc";
          field = p.slice(1);
        }

        // relation sort: relation.field
        if (field.includes(".")) {
          const [rel, f] = field.split(".");
          if (
            config.relations?.[rel] &&
            config.relations[rel].allowedSort?.includes(f)
          ) {
            return { [rel]: { [f]: dir } };
          }
          return null;
        }

        // root sort
        if (!config.allowedSort.includes(field)) return null;

        return { [field]: dir };
      })
      .filter(Boolean);
  }

  // ---------- SELECT (root fields) ----------
  let select;
  if (query.fields) {
    const requested = query.fields.split(",");
    const allowed = requested.filter((f) => config.allowedSelect.includes(f));

    if (allowed.length) {
      select = {};
      allowed.forEach((f) => (select[f] = true));
    }
  }

  // ---------- INCLUDE (relations) ----------
  let include;
  if (query.include) {
    const rels = query.include.split(",");

    include = {};
    rels.forEach((rel) => {
      if (config.relations?.[rel]) {
        include[rel] = {
          select: config.relations[rel].select.reduce((acc, f) => {
            acc[f] = true;
            return acc;
          }, {}),
        };
      }
    });
  }

  return {
    skip,
    take,
    where,
    orderBy,
    select,
    include,
    page,
    limit,
  };
};

module.exports = { buildQuery };
