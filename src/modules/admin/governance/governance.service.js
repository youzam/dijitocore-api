const prisma = require('../../../config/prisma');
const AppError = require('../../../utils/AppError');
const { logAudit } = require('../../../utils/audit.helper');
const subscriptionService = require('../../subscription/subscription.service');
const authService = require('../../auth/auth.service');
const coreAuth = require('../../auth/core.auth.service');
const {
  lockUserAccount,
  unlockUserAccount,
} = require('../../../utils/security.helper');

/*
|--------------------------------------------------------------------------
| Business Lifecycle Status Update (EXISTING LOGIC - PRESERVED)
|--------------------------------------------------------------------------
*/

exports.updateBusinessStatus = async (businessId, status) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError('governance.business_not_found', 404);
  }

  const allowedTransitions = {
    PENDING: ['ACTIVE', 'TERMINATED'],
    ACTIVE: ['GRACE', 'TERMINATED'],
    GRACE: ['ACTIVE', 'SUSPENDED'],
    SUSPENDED: ['ACTIVE', 'TERMINATED'],
    TERMINATED: [],
  };

  const currentStatus = business.status;

  if (!allowedTransitions[currentStatus].includes(status)) {
    throw new AppError('governance.invalid_status_transition', 400);
  }

  const updated = await prisma.business.update({
    where: { id: businessId },
    data: { status },
  });

  await logAudit({
    userId: null,
    entityType: 'BUSINESS',
    entityId: businessId,
    action: 'BUSINESS_STATUS_UPDATED',
    metadata: {
      previousStatus: currentStatus,
      newStatus: status,
    },
    module: 'GOVERNANCE',
    actorType: 'ADMIN',
  });
  return updated;
};

/*
|--------------------------------------------------------------------------
| List Businesses
|--------------------------------------------------------------------------
*/

exports.listBusinesses = async (query) => {
  const { page = 1, limit = 20, status, country, packageId } = query;

  const skip = (page - 1) * limit;
  const take = Number(limit);

  const where = {};

  if (status) where.status = status;
  if (country) where.country = country;

  if (packageId) {
    where.subscriptions = {
      some: { packageId },
    };
  }

  const [businesses, total] = await Promise.all([
    prisma.business.findMany({
      where,
      skip,
      take,
      include: {
        users: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),

    prisma.business.count({ where }),
  ]);

  return {
    total,
    page: Number(page),
    limit: take,
    businesses,
  };
};

/*
|--------------------------------------------------------------------------
| Business Timeline
|--------------------------------------------------------------------------
*/

exports.getBusinessTimeline = async (businessId) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError('governance.business_not_found', 404);
  }

  const [subscriptions, payments] = await Promise.all([
    prisma.subscription.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    }),

    prisma.subscriptionPayment.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    businessId,
    subscriptions,
    payments,
  };
};

/*
|--------------------------------------------------------------------------
| Business Revenue Summary
|--------------------------------------------------------------------------
*/

exports.getBusinessRevenueSummary = async (businessId) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError('governance.business_not_found', 404);
  }

  const revenue = await prisma.subscriptionPayment.aggregate({
    where: {
      businessId,
      status: 'SUCCESS',
    },
    _sum: { amount: true },
    _count: { id: true },
  });

  return {
    businessId,
    totalRevenue: revenue._sum.amount || 0,
    totalTransactions: revenue._count.id,
  };
};

/*
|--------------------------------------------------------------------------
| Force Subscription Change
|--------------------------------------------------------------------------
*/

exports.changeBusinessSubscription = async (businessId, packageId) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError('governance.business_not_found', 404);
  }

  const result = await subscriptionService.createSubscription({
    businessId,
    packageId,
    forcedByAdmin: true,
  });

  await logAudit({
    userId: null,
    entityType: 'SUBSCRIPTION',
    entityId: result.id,
    action: 'BUSINESS_SUBSCRIPTION_CHANGED',
    metadata: {
      businessId,
      packageId,
    },
    module: 'GOVERNANCE',
    actorType: 'ADMIN',
  });

  return result;
};

/*
|--------------------------------------------------------------------------
| Extend Business Grace Period
|--------------------------------------------------------------------------
*/

exports.extendBusinessGracePeriod = async (businessId, days) => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      businessId,
      status: 'GRACE',
    },
  });

  if (!subscription) {
    throw new AppError('governance.no_grace_subscription', 404);
  }

  const newGraceDate = new Date(subscription.graceUntil);
  newGraceDate.setDate(newGraceDate.getDate() + days);

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: { graceUntil: newGraceDate },
  });

  await logAudit({
    userId: null,
    entityType: 'SUBSCRIPTION',
    entityId: subscription.id,
    action: 'BUSINESS_GRACE_EXTENDED',
    metadata: {
      businessId,
      days,
      newGraceUntil: newGraceDate,
    },
    module: 'GOVERNANCE',
    actorType: 'ADMIN',
  });
  return updated;
};

/*
|--------------------------------------------------------------------------
| Global User Directory
|--------------------------------------------------------------------------
*/

exports.listUsers = async (query) => {
  const { page = 1, limit = 20, role, status, businessId } = query;

  const skip = (page - 1) * limit;
  const take = Number(limit);

  const where = {};

  if (role) where.role = role;
  if (status) where.status = status;
  if (businessId) where.businessId = businessId;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      include: {
        business: {
          select: {
            id: true,
            name: true,
            businessCode: true,
          },
        },
      },
    }),

    prisma.user.count({ where }),
  ]);

  return {
    total,
    page: Number(page),
    limit: take,
    users,
  };
};

/*
|--------------------------------------------------------------------------
| Lock User
|--------------------------------------------------------------------------
*/

exports.lockUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('governance.user_not_found', 404);
  }

  const lockUntil = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { lockUntil },
  });

  // 🔒 Invalidate all user sessions
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });

  await logAudit({
    userId: null,
    entityType: 'USER',
    entityId: userId,
    action: 'USER_LOCKED',
    metadata: {
      lockUntil,
    },
    module: 'GOVERNANCE',
    actorType: 'ADMIN',
  });
  return updated;
};

/*
|--------------------------------------------------------------------------
| Unlock User
|--------------------------------------------------------------------------
*/

exports.unlockUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('governance.user_not_found', 404);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      lockUntil: null,
      failedLoginAttempts: 0,
    },
  });

  await logAudit({
    userId: null,
    entityType: 'USER',
    entityId: userId,
    action: 'USER_UNLOCKED',
    module: 'GOVERNANCE',
    actorType: 'ADMIN',
  });
  return updated;
};

/*
|--------------------------------------------------------------------------
| Update User Status
|--------------------------------------------------------------------------
*/

exports.updateUserStatus = async (userId, status) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('governance.user_not_found', 404);
  }

  const allowedStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

  if (!allowedStatuses.includes(status)) {
    throw new AppError('governance.invalid_user_status', 400);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  await logAudit({
    userId: null,
    entityType: 'USER',
    entityId: userId,
    action: 'USER_STATUS_UPDATED',
    metadata: {
      newStatus: status,
    },
    module: 'GOVERNANCE',
    actorType: 'ADMIN',
  });

  return updated;
};

/*
|--------------------------------------------------------------------------
| Force Logout User
|--------------------------------------------------------------------------
*/

exports.forceLogoutUser = async (userId) => {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });

  // 🔒 invalidate access tokens via version bump
  await prisma.user.update({
    where: { id: userId },
    data: {
      tokenVersion: {
        increment: 1,
      },
    },
  });

  await logAudit({
    userId: null,
    entityType: 'USER',
    entityId: userId,
    action: 'USER_FORCE_LOGOUT',
    module: 'GOVERNANCE',
    actorType: 'ADMIN',
  });

  return { success: true };
};

/*
|--------------------------------------------------------------------------
| Impersonate User (SECURE)
|--------------------------------------------------------------------------
*/

exports.impersonateUser = async (adminId, userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('governance.user_not_found', 404);
  }

  /*
  |--------------------------------------------------------------------------
  | Prevent impersonating locked users
  |--------------------------------------------------------------------------
  */

  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new AppError('governance.user_locked', 403);
  }

  /*
  |--------------------------------------------------------------------------
  | Prevent impersonating suspended users
  |--------------------------------------------------------------------------
  */

  if (user.status === 'SUSPENDED') {
    throw new AppError('governance.user_suspended', 403);
  }

  /*
  |--------------------------------------------------------------------------
  | Create impersonation token
  |--------------------------------------------------------------------------
  */
  const tokens = coreAuth.generateAuthTokens({
    sub: user.id,
    identity_type: 'user',
    role: user.role,
    businessId: user.businessId,
    impersonatedBy: adminId,
    tokenVersion: user.tokenVersion,
  });

  await logAudit({
    userId: adminId,
    entityType: 'USER',
    entityId: user.id,
    action: 'ADMIN_IMPERSONATE_USER',
    metadata: {
      businessId: user.businessId,
    },
    module: 'GOVERNANCE',
    actorType: 'ADMIN',
  });

  return {
    tokens,
    user,
  };
};

/*
|--------------------------------------------------------------------------
| Customer Summary
|--------------------------------------------------------------------------
*/

exports.getCustomerSummary = async (customerId) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!customer) {
    throw new AppError('governance.customer_not_found', 404);
  }

  return customer;
};

/*
|--------------------------------------------------------------------------
| Blacklist Customer
|--------------------------------------------------------------------------
*/

exports.blacklistCustomer = async (customerId) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw new AppError('governance.customer_not_found', 404);
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { isBlacklisted: true },
  });

  await logAudit({
    userId: null,
    entityType: 'CUSTOMER',
    entityId: customerId,
    action: 'CUSTOMER_BLACKLISTED',
    module: 'GOVERNANCE',
    actorType: 'ADMIN',
  });

  return updated;
};

/*
|--------------------------------------------------------------------------
| Remove Customer Blacklist
|--------------------------------------------------------------------------
*/

exports.unblacklistCustomer = async (customerId) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw new AppError('governance.customer_not_found', 404);
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { isBlacklisted: false },
  });

  await logAudit({
    userId: null,
    entityType: 'CUSTOMER',
    entityId: customerId,
    action: 'CUSTOMER_UNBLACKLISTED',
    module: 'GOVERNANCE',
    actorType: 'ADMIN',
  });

  return updated;
};

exports.getBusinessProfile = async (businessId) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      owner: true,
      subscriptions: true,
      users: true,
      _count: {
        select: {
          customers: true,
          users: true,
        },
      },
    },
  });

  if (!business) {
    throw new Error('Business not found');
  }

  return business;
};

/*
|--------------------------------------------------------------------------
| Reset Business User Password
|--------------------------------------------------------------------------
*/

exports.resetUserPassword = async (userId, newPassword) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('governance.user_not_found', 404);
  }

  const result = await authService.resetUserPassword(userId, newPassword);

  await logAudit({
    userId: null,
    entityType: 'USER',
    entityId: userId,
    action: 'USER_PASSWORD_RESET',
    module: 'GOVERNANCE',
    actorType: 'ADMIN',
  });

  return result;
};

/*
|--------------------------------------------------------------------------
| Admin Audit Log View
|--------------------------------------------------------------------------
*/

exports.listAdminAuditLogs = async (query) => {
  const { page = 1, limit = 20, action, entityType, module, from, to } = query;

  const skip = (page - 1) * limit;
  const take = Number(limit);

  const where = {
    actorType: 'ADMIN',
  };

  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (module) where.module = module;

  if (from || to) {
    where.createdAt = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to) }),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    }),

    prisma.auditLog.count({ where }),
  ]);

  return {
    total,
    page: Number(page),
    limit: take,
    logs,
  };
};

/*
|--------------------------------------------------------------------------
| Risk Flags / Fraud Indicators
|--------------------------------------------------------------------------
*/

exports.getRiskFlags = async () => {
  const [blacklistedCustomers, lockedUsers, suspendedBusinesses] =
    await Promise.all([
      prisma.customer.count({
        where: { isBlacklisted: true },
      }),

      prisma.user.count({
        where: {
          lockUntil: {
            gt: new Date(),
          },
        },
      }),

      prisma.business.count({
        where: {
          status: {
            in: ['SUSPENDED', 'GRACE'],
          },
        },
      }),
    ]);

  return {
    blacklistedCustomers,
    lockedUsers,
    suspendedBusinesses,
  };
};

/*
|--------------------------------------------------------------------------
| Global Search (Cross Tenant)
|--------------------------------------------------------------------------
*/

const DEFAULT_LIMIT = 10;
const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;
const MIN_QUERY_LENGTH = 2;

/*
|--------------------------------------------------------------------------
| MODULE → RESOURCES MAP
|--------------------------------------------------------------------------
*/
const MODULE_RESOURCES = {
  governance: ['businesses', 'users', 'customers'],

  commerce: [
    'subscriptions',
    'subscriptionPackages',
    'payments',
    'coupons',
    'financialAdjustments',
  ],

  support: ['tickets'],

  communication: ['notifications'],

  reporting: ['reportExports'],

  security: ['auditLogs', 'loginActivities'],

  compliance: ['dataRequests', 'consents'],

  settings: ['systemSettings'],
};

// GLOBAL FALLBACK
const GLOBAL_RESOURCES = [
  'businesses',
  'users',
  'customers',
  'subscriptions',
  'payments',
  'tickets',
];

/*
|--------------------------------------------------------------------------
| PAGINATION
|--------------------------------------------------------------------------
*/
const getPagination = (query) => {
  let limit = parseInt(query.limit) || DEFAULT_LIMIT;
  let page = parseInt(query.page) || DEFAULT_PAGE;

  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (limit < 1) limit = DEFAULT_LIMIT;
  if (page < 1) page = DEFAULT_PAGE;

  return {
    limit,
    page,
    skip: (page - 1) * limit,
  };
};

/*
|--------------------------------------------------------------------------
| SEARCH HELPER (BETTER MATCHING)
|--------------------------------------------------------------------------
*/
const buildSearch = (field, value) => ({
  OR: [
    { [field]: { startsWith: value, mode: 'insensitive' } },
    { [field]: { contains: value, mode: 'insensitive' } },
  ],
});

/*
|--------------------------------------------------------------------------
| RESOURCE HANDLERS
|--------------------------------------------------------------------------
*/
const RESOURCE_HANDLERS = {
  businesses: (search, p) =>
    prisma.business.findMany({
      where: {
        OR: [buildSearch('name', search), buildSearch('businessCode', search)],
      },
      take: p.limit,
      skip: p.skip,
      select: { id: true, name: true, businessCode: true },
    }),

  users: (search, p) =>
    prisma.user.findMany({
      where: {
        OR: [
          buildSearch('email', search),
          buildSearch('firstName', search),
          buildSearch('lastName', search),
          { phone: { contains: search } },
        ],
      },
      take: p.limit,
      skip: p.skip,
      select: { id: true, email: true, phone: true },
    }),

  customers: (search, p) =>
    prisma.customer.findMany({
      where: {
        OR: [buildSearch('name', search), { phone: { contains: search } }],
      },
      take: p.limit,
      skip: p.skip,
      select: { id: true, name: true, phone: true },
    }),

  subscriptions: (search, p) =>
    prisma.subscription.findMany({
      where: buildSearch('subscriptionCode', search),
      take: p.limit,
      skip: p.skip,
      select: { id: true, subscriptionCode: true },
    }),

  payments: (search, p) =>
    prisma.installmentPayment.findMany({
      where: buildSearch('reference', search),
      take: p.limit,
      skip: p.skip,
      select: { id: true, reference: true, amount: true },
    }),

  coupons: (search, p) =>
    prisma.coupon.findMany({
      where: buildSearch('code', search),
      take: p.limit,
      skip: p.skip,
      select: { id: true, code: true },
    }),

  tickets: (search, p) =>
    prisma.ticket.findMany({
      where: buildSearch('subject', search),
      take: p.limit,
      skip: p.skip,
      select: { id: true, subject: true, status: true },
    }),

  subscriptionPackages: (search, p) =>
    prisma.subscriptionPackage.findMany({
      where: buildSearch('name', search),
      take: p.limit,
      skip: p.skip,
      select: { id: true, name: true },
    }),

  notifications: (search, p) =>
    prisma.notification.findMany({
      where: buildSearch('title', search),
      take: p.limit,
      skip: p.skip,
      select: { id: true, title: true },
    }),

  reportExports: (search, p) =>
    prisma.reportExport.findMany({
      where: buildSearch('fileName', search),
      take: p.limit,
      skip: p.skip,
      select: { id: true, fileName: true },
    }),
};

/*
|--------------------------------------------------------------------------
| SAFE ROUTE DETECTION
|--------------------------------------------------------------------------
*/
const detectRouteContext = (req) => {
  if (!req) return {};

  const source = req.originalUrl || req.baseUrl || req.headers?.referer || '';

  const segments = source.toLowerCase().split('/');

  for (const resource of Object.keys(RESOURCE_HANDLERS)) {
    const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;

    if (segments.includes(resource) || segments.includes(singular)) {
      return { resource };
    }
  }

  for (const module of Object.keys(MODULE_RESOURCES)) {
    if (segments.includes(module)) {
      return { module };
    }
  }

  return {};
};

/*
|--------------------------------------------------------------------------
| GLOBAL SEARCH (FINAL)
|--------------------------------------------------------------------------
*/
exports.globalSearch = async (query, options = {}) => {
  const { q } = query;
  const { req, resource } = options;

  if (!q || q.trim().length < MIN_QUERY_LENGTH) {
    return {};
  }

  const search = q.trim();
  const pagination = getPagination(query);

  const detected = detectRouteContext(req);

  const targetResource = resource || detected.resource;
  const module = detected.module;

  if (targetResource && RESOURCE_HANDLERS[targetResource]) {
    return {
      [targetResource]: await RESOURCE_HANDLERS[targetResource](
        search,
        pagination,
      ),
      pagination,
    };
  }

  if (module && MODULE_RESOURCES[module]) {
    const resources = MODULE_RESOURCES[module];

    const entries = await Promise.all(
      resources.map(async (r) => {
        if (!RESOURCE_HANDLERS[r]) return [r, []];
        const data = await RESOURCE_HANDLERS[r](search, pagination);
        return [r, data];
      }),
    );

    return {
      ...Object.fromEntries(entries),
      pagination,
    };
  }

  const entries = await Promise.all(
    GLOBAL_RESOURCES.map(async (r) => {
      if (!RESOURCE_HANDLERS[r]) return [r, []];
      const data = await RESOURCE_HANDLERS[r](search, pagination);
      return [r, data];
    }),
  );

  return {
    ...Object.fromEntries(entries),
    pagination,
  };
};

/*
|--------------------------------------------------------------------------
| ADMIN LOCK AND UNLOCK USER
|--------------------------------------------------------------------------
*/
exports.lockUser = async ({ userId, durationMs, actorId }) => {
  const result = await lockUserAccount({
    userId,
    durationMs,
    reason: 'ADMIN_MANUAL_LOCK',
    actorId,
  });

  await logAudit({
    userId: actorId, // admin performing action
    entityType: 'USER',
    entityId: userId,
    action: 'USER_LOCKED',
    module: 'GOVERNANCE',
    actorType: 'ADMIN',
    metadata: {
      durationMs,
      reason: 'MANUAL_LOCK',
    },
  });

  return result;
};

exports.unlockUser = async ({ userId, actorId }) => {
  const result = await unlockUserAccount({
    userId,
    actorId,
  });

  await logAudit({
    userId: actorId,
    entityType: 'USER',
    entityId: userId,
    action: 'USER_UNLOCKED',
    module: 'GOVERNANCE',
    actorType: 'ADMIN',
    metadata: {
      reason: 'MANUAL_UNLOCK',
    },
  });
  return result;
};
