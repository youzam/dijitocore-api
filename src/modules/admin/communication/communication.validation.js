const Joi = require("joi");

/*
|--------------------------------------------------------------------------
| ENUMS
|--------------------------------------------------------------------------
*/
const placementEnum = [
  "TOP_BAR",
  "SIDEBAR",
  "CENTER_MODAL",
  "BANNER",
  "INLINE",
];

const eventTypeEnum = [
  "GENERAL",
  "HOLIDAY",
  "PROMOTION",
  "SYSTEM",
  "BILLING",
  "SECURITY",
];

const priorityEnum = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const channelEnum = ["IN_APP", "SMS", "EMAIL"];

/*
|--------------------------------------------------------------------------
| SEGMENT SCHEMA
|--------------------------------------------------------------------------
*/
const segmentSchema = Joi.object({
  type: Joi.string().required(),
  rules: Joi.object().optional(),
});

/*
|--------------------------------------------------------------------------
| CREATE ANNOUNCEMENT
|--------------------------------------------------------------------------
*/
exports.createAnnouncement = Joi.object({
  title: Joi.string().min(3).max(255).required(),

  message: Joi.string().min(3).required(),

  priority: Joi.string()
    .valid(...priorityEnum)
    .required(),

  placement: Joi.string()
    .valid(...placementEnum)
    .required(),

  eventType: Joi.string()
    .valid(...eventTypeEnum)
    .optional(),

  startAt: Joi.date().optional(),

  endAt: Joi.date().greater(Joi.ref("startAt")).optional(),

  trialOnly: Joi.boolean().optional(),

  isEmergency: Joi.boolean().optional(),

  /*
  |--------------------------------------------------------------------------
  | TARGETING
  |--------------------------------------------------------------------------
  */
  countries: Joi.array().items(Joi.string()).optional(),

  packages: Joi.array().items(Joi.string()).optional(),

  segments: Joi.array().items(segmentSchema).optional(),

  /*
  |--------------------------------------------------------------------------
  | NOTIFICATIONS
  |--------------------------------------------------------------------------
  */
  sendNotification: Joi.boolean().optional(),

  channels: Joi.array()
    .items(Joi.string().valid(...channelEnum))
    .when("sendNotification", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
});

/*
|--------------------------------------------------------------------------
| UPDATE ANNOUNCEMENT
|--------------------------------------------------------------------------
*/
exports.updateAnnouncement = Joi.object({
  title: Joi.string().min(3).max(255).optional(),

  message: Joi.string().min(3).optional(),

  priority: Joi.string()
    .valid(...priorityEnum)
    .optional(),

  placement: Joi.string()
    .valid(...placementEnum)
    .optional(),

  eventType: Joi.string()
    .valid(...eventTypeEnum)
    .optional(),

  startAt: Joi.date().optional(),

  endAt: Joi.date().greater(Joi.ref("startAt")).optional(),

  trialOnly: Joi.boolean().optional(),

  isEmergency: Joi.boolean().optional(),

  /*
  |--------------------------------------------------------------------------
  | TARGETING (FULL REPLACEMENT)
  |--------------------------------------------------------------------------
  */
  countries: Joi.array().items(Joi.string()).optional(),

  packages: Joi.array().items(Joi.string()).optional(),

  segments: Joi.array().items(segmentSchema).optional(),

  /*
  |--------------------------------------------------------------------------
  | NOTIFICATIONS
  |--------------------------------------------------------------------------
  */
  sendNotification: Joi.boolean().optional(),

  channels: Joi.array()
    .items(Joi.string().valid(...channelEnum))
    .optional(),
});
/*
|--------------------------------------------------------------------------
| Messaging
|--------------------------------------------------------------------------
*/

exports.sendBroadcast = Joi.object({
  title: Joi.string().required(),
  body: Joi.string().required(),

  channels: Joi.array().items(Joi.string()).min(1).required(),

  target: Joi.object({
    userStatus: Joi.string(),
    country: Joi.string(),
    subscriptionPackageId: Joi.string(),
    businessOwnersOnly: Joi.boolean(),
    blacklisted: Joi.boolean(),
  }),

  customRecipients: Joi.object({
    emails: Joi.array().items(Joi.string().email()),
    phones: Joi.array().items(Joi.string()),
  }),
});

exports.sendBatch = Joi.object({
  title: Joi.string().required(),
  body: Joi.string().required(),
  channel: Joi.string().required(),
  userIds: Joi.array().items(Joi.string()).required(),
});

/*
|--------------------------------------------------------------------------
| Templates
|--------------------------------------------------------------------------
*/

exports.createTemplate = Joi.object({
  name: Joi.string().required(),
  subject: Joi.string().allow(""),
  body: Joi.string().required(),
  channel: Joi.string().required(),
});

exports.updateTemplate = Joi.object({
  name: Joi.string(),
  subject: Joi.string().allow(""),
  body: Joi.string(),
  channel: Joi.string(),
});
