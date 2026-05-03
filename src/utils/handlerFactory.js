const prisma = require("../config/prisma");
const catchAsync = require("./catchAsync");
const { buildQuery } = require("./apiQueryBuilder");
const response = require("./response");

exports.getAll = (model) =>
  catchAsync(async (req, res) => {
    const { skip, take, where, orderBy, select, include, page, limit } =
      buildQuery(model, req.query);

    const [data, total] = await Promise.all([
      prisma[model].findMany({
        where,
        orderBy,
        skip,
        take,
        ...(select && { select }),
        ...(include && { include }),
      }),
      prisma[model].count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return response.successPaginated(req, res, data, {
      page,
      limit,
      total,
      totalPages,
    });
  });
