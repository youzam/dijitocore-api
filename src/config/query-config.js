const QUERY_CONFIG = {
  systemAdmin: {
    allowedFilters: ['id', 'email', 'status', 'roleId', 'createdAt'],

    allowedSort: ['createdAt', 'updatedAt', 'email'],

    searchFields: ['email'],

    allowedSelect: [
      'id',
      'email',
      'status',
      'roleId',
      'createdAt',
      'updatedAt',
    ],

    relations: {
      role: {
        fields: ['name'],
        select: ['id', 'name'],
        allowedSort: ['name'],
      },
    },
  },
  user: {
    allowedFilters: ['id', 'email', 'role', 'isActive', 'createdAt'],
    allowedSort: ['createdAt', 'email'],
    searchFields: ['email', 'firstName', 'lastName'],

    // 🔐 fields allowed for SELECT (root)
    allowedSelect: [
      'id',
      'email',
      'firstName',
      'lastName',
      'role',
      'createdAt',
    ],

    // 🔗 relations config
    relations: {
      business: {
        fields: ['name', 'status'], // for filtering
        select: ['id', 'name', 'status'], // for include/select
        allowedSort: ['name'], // relation sort fields
      },
    },
  },

  customer: {
    allowedFilters: ['id', 'name', 'phone', 'businessId', 'createdAt'],
    allowedSort: ['createdAt', 'name'],
    searchFields: ['name', 'phone'],

    allowedSelect: ['id', 'name', 'phone', 'businessId', 'createdAt'],

    relations: {
      business: {
        fields: ['name'],
        select: ['id', 'name'],
        allowedSort: ['name'],
      },
    },
  },

  subscriptionPackage: {
    allowedFilters: ['id', 'name', 'code', 'isActive', 'createdAt'],

    searchFields: ['name', 'code'],

    allowedSort: [
      'name',
      'code',
      'priceMonthly',
      'priceYearly',
      'createdAt',
      'updatedAt',
    ],

    allowedSelect: [
      'id',
      'name',
      'code',
      'priceMonthly',
      'priceYearly',
      'setupFee',
      'features',
      'limits',
      'isActive',
      'createdAt',
      'updatedAt',
    ],

    relations: {},
  },
};

module.exports = { QUERY_CONFIG };
