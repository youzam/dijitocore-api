const QUERY_CONFIG = {
  user: {
    allowedFilters: ["id", "email", "role", "isActive", "createdAt"],
    allowedSort: ["createdAt", "email"],
    searchFields: ["email", "firstName", "lastName"],

    // 🔐 fields allowed for SELECT (root)
    allowedSelect: [
      "id",
      "email",
      "firstName",
      "lastName",
      "role",
      "createdAt",
    ],

    // 🔗 relations config
    relations: {
      business: {
        fields: ["name", "status"], // for filtering
        select: ["id", "name", "status"], // for include/select
        allowedSort: ["name"], // relation sort fields
      },
    },
  },

  customer: {
    allowedFilters: ["id", "name", "phone", "businessId", "createdAt"],
    allowedSort: ["createdAt", "name"],
    searchFields: ["name", "phone"],

    allowedSelect: ["id", "name", "phone", "businessId", "createdAt"],

    relations: {
      business: {
        fields: ["name"],
        select: ["id", "name"],
        allowedSort: ["name"],
      },
    },
  },
};

module.exports = { QUERY_CONFIG };
