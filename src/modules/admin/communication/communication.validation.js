const Joi = require("joi");

/*
|--------------------------------------------------------------------------
| Announcements
|--------------------------------------------------------------------------
*/

exports.createAnnouncement = Joi.object({
  title: Joi.string().required(),
  message: Joi.string().required(),
  priority: Joi.string().required(),
  startAt: Joi.date().required(),
  endAt: Joi.date().required(),
  targetCountry: Joi.string(),
  targetPackageId: Joi.string(),
  trialOnly: Joi.boolean(),
  isEmergency: Joi.boolean(),
});

exports.updateAnnouncement = Joi.object({
  title: Joi.string(),
  message: Joi.string(),
  priority: Joi.string(),
  startAt: Joi.date(),
  endAt: Joi.date(),
  targetCountry: Joi.string(),
  targetPackageId: Joi.string(),
  trialOnly: Joi.boolean(),
  isEmergency: Joi.boolean(),
});

/*
|--------------------------------------------------------------------------
| Messaging
|--------------------------------------------------------------------------
*/

exports.sendBroadcast = Joi.object({
  title: Joi.string().required(),
  body: Joi.string().required(),
  channel: Joi.string().required(),
  filters: Joi.object({
    country: Joi.string(),
    packageId: Joi.string(),
    trialOnly: Joi.boolean(),
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
