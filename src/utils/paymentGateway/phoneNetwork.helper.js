exports.detectNetwork = (phone) => {
  if (!phone) return null;

  const normalized = phone.replace(/^(\+255|255)/, "0");

  if (/^(074|075|076)/.test(normalized)) return "MPESA";
  if (/^(078|079|068|069)/.test(normalized)) return "AIRTEL";

  return "UNKNOWN";
};
