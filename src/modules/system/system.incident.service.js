const prisma = require("../../config/prisma");
const AppError = require("../../utils/appError");

exports.createIncident = async (data, userId) => {
  return prisma.supportIncident.create({
    data: {
      title: data.title,
      description: data.description,
      severity: data.severity,
      createdBy: userId,
    },
  });
};

exports.updateIncident = async (id, data) => {
  const incident = await prisma.supportIncident.findUnique({
    where: { id },
  });

  if (!incident) {
    throw new AppError("incident.notFound", 404);
  }

  return prisma.supportIncident.update({
    where: { id },
    data,
  });
};
