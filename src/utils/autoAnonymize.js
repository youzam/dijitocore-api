const isObject = (val) => val && typeof val === "object" && !Array.isArray(val);

// =========================
// 🔥 MODEL DETECTION (CONTROLLED)
// =========================
const detectModel = (obj) => {
  if (!obj || typeof obj !== "object") return null;

  // Customer
  if ("customerId" in obj && "phone" in obj) return "Customer";

  // User
  if ("role" in obj && "email" in obj) return "User";

  // Business
  if ("name" in obj && "email" in obj && "phone" in obj) return "Business";

  // Contract (embedded)
  if ("customerName" in obj && "customerPhone" in obj) return "Contract";

  return null;
};

// =========================
// 🔥 ANONYMIZATION RULES (MERGED)
// =========================
const applyAnonymization = (obj) => {
  const model = detectModel(obj);
  if (!model) return obj;

  // =========================
  // CUSTOMER
  // =========================
  if (model === "Customer" && obj.isDeleted) {
    return {
      ...obj,
      name: "Deleted Customer",
      phone: null,
      email: null,
    };
  }

  // =========================
  // USER
  // =========================
  if (model === "User" && obj.isDeleted) {
    return {
      ...obj,
      name: "Deleted User",
      email: null,
      phone: null,
    };
  }

  // =========================
  // BUSINESS
  // =========================
  if (model === "Business" && obj.isDeleted) {
    return {
      ...obj,
      name: "Deleted Business",
      email: null,
      phone: null,
    };
  }

  // =========================
  // CONTRACT (EMBEDDED PII)
  // =========================
  if (model === "Contract") {
    if (obj.customer?.isDeleted || obj.isDeleted) {
      return {
        ...obj,
        customerName: "Deleted Customer",
        customerPhone: null,
      };
    }
  }

  return obj;
};

// =========================
// 🔁 RECURSIVE ENGINE
// =========================
const autoAnonymize = (data) => {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map(autoAnonymize);
  }

  if (isObject(data)) {
    let cloned = { ...data };

    // apply rules
    cloned = applyAnonymization(cloned);

    // recurse deeply
    Object.keys(cloned).forEach((key) => {
      cloned[key] = autoAnonymize(cloned[key]);
    });

    return cloned;
  }

  return data;
};

module.exports = autoAnonymize;
