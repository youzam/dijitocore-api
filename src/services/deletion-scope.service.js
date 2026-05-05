// src/services/deletion-scope.service.js

const prisma = require('../config/prisma');
const { getChildren, isSystemModel } = require('../config/data-graph');

/**
 * Build deletion/export scope using graph traversal
 * Returns: { modelName: [ids] }
 */
const buildScope = async ({ rootModel, rootId }) => {
  const scope = {};
  const visited = new Set();

  // queue for BFS traversal
  const queue = [{ model: rootModel, ids: [rootId] }];

  while (queue.length > 0) {
    const { model, ids } = queue.shift();

    if (!ids.length) continue;
    if (isSystemModel(model)) continue;

    // avoid re-processing same model+ids combo
    const visitKey = `${model}:${ids.join(',')}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);

    // store IDs in scope
    if (!scope[model]) scope[model] = new Set();
    ids.forEach((id) => scope[model].add(id));

    // get children from graph
    const children = getChildren(model);

    for (const child of children) {
      const { model: childModel, foreignKey } = child;

      if (!prisma[childModel]) continue;

      try {
        const records = await prisma[childModel].findMany({
          where: {
            [foreignKey]: { in: ids },
          },
          select: { id: true },
        });

        const childIds = records.map((r) => r.id);

        if (childIds.length > 0) {
          queue.push({
            model: childModel,
            ids: childIds,
          });
        }
      } catch (err) {
        console.error(
          `[SCOPE ERROR] Failed fetching ${childModel}:`,
          err.message,
        );
      }
    }
  }

  // convert Sets → Arrays
  const finalScope = {};
  for (const model in scope) {
    finalScope[model] = Array.from(scope[model]);
  }

  return finalScope;
};

module.exports = {
  buildScope,
};
