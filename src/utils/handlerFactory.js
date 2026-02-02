const prisma = require("../config/prisma");

/**
 * Generic LIST handler (pagination + search + filter + sort)
 */

exports.list = async ({
  model,
  query = {},
  businessFilter = {},
  searchableFields = [],
  filterableFields = [],
  defaultSort = "createdAt",
}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const sortBy = query.sortBy || defaultSort;
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  const where = {
    ...businessFilter,
  };

  // filters
  filterableFields.forEach((field) => {
    if (query[field]) where[field] = query[field];
  });

  // search
  if (query.search && searchableFields.length) {
    where.OR = searchableFields.map((field) => ({
      [field]: {
        contains: query.search,
        mode: "insensitive",
      },
    }));
  }

  const [items, total] = await prisma.$transaction([
    model.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    model.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};
