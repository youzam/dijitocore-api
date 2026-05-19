const send = async ({ notification, recipient }) => {
  console.log('📱 [DEV SMS]');

  console.log('To:', recipient || notification?.metadata?.phone || null);

  console.log('Message:', notification?.message || null);
};

module.exports = { send };
