const { AsyncLocalStorage } = require("async_hooks");

const asyncLocalStorage = new AsyncLocalStorage();

exports.runWithContext = (data, callback) => {
  return asyncLocalStorage.run(data, callback);
};

exports.getContext = () => {
  return asyncLocalStorage.getStore();
};
