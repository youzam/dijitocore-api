const dashboardSnapshotJob = require("./dashboard.snapshot.job");

exports.startJobs = () => {
  dashboardSnapshotJob.start();
};
