const send = async ({ to, message }) => {
  console.log("📱 [DEV SMS]");
  console.log("To:", to);
  console.log("Message:", message);
};

module.exports = { send };
