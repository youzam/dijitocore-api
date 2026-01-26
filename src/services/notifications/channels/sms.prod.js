const axios = require("axios");

const send = async ({ to, message }) => {
  await axios.post(
    "https://apisms.beem.africa/v1/send",
    {
      source_addr: process.env.SMS_FROM,
      schedule_time: "",
      encoding: 0,
      message,
      recipients: [{ recipient_id: 1, dest_addr: to }],
    },
    {
      auth: {
        username: process.env.BEEM_API_KEY,
        password: process.env.BEEM_SECRET,
      },
    },
  );
};

module.exports = { send };
