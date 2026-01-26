const send = async ({ to, subject, body }) => {
  console.log("📧 [DEV EMAIL]");
  console.log("To:", to);
  console.log("Subject:", subject);
  console.log("Body:", body);
};

module.exports = { send };
