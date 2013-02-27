
var ready = false;

var taskqueue = [];

var addJob = function(job, parameters) {
  taskqueue.push({ job: job, parameters: parameters });
}

var execute = function(db) {
  if (ready) {
    taskqueue.forEach(function(d) {
      db[d.job].apply(null, d.parameters);
    })
  }
}
