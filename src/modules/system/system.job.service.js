const prisma = require("../../config/prisma");

exports.logJobExecution = async ({
  jobName,
  status,
  startedAt,
  finishedAt,
  errorMessage = null,
  retryCount = 0,
}) => {
  const durationMs =
    finishedAt && startedAt ? finishedAt.getTime() - startedAt.getTime() : null;

  return prisma.systemJobLog.create({
    data: {
      jobName,
      status,
      startedAt,
      finishedAt,
      durationMs,
      errorMessage,
      retryCount,
    },
  });
};
