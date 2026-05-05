const axios = require('axios');
const env = require('../../../config/env');

const send = async ({ notification }) => {
  const phone = notification.metadata?.phone;

  if (!phone) {
    throw new Error('SMS: phone not found in metadata');
  }

  await axios.post(
    'https://apisms.beem.africa/v1/send',
    {
      source_addr: env.sms.from,
      schedule_time: '',
      encoding: 0,
      message: notification.message,
      recipients: [
        {
          recipient_id: 1,
          dest_addr: phone,
        },
      ],
    },
    {
      auth: {
        username: env.sms.beemKey,
        password: env.sms.beemSecret,
      },
    },
  );

  return { success: true };
};

module.exports = { send };
