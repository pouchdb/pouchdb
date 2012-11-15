"use strict";

var results_db_name = 'test_results';
var results_db;
var ui;

function formatDate(date) {
  var diff = (((new Date()).getTime() - date.getTime()) / 1000);
  var day_diff = Math.floor(diff / 86400);

  if ( isNaN(day_diff) || day_diff < 0 || day_diff >= 31 )
    return;

  return day_diff === 0 && (
    diff < 60 && "just now" ||
      diff < 120 && "1 minute ago" ||
      diff < 3600 && Math.floor( diff / 60 ) + " minutes ago" ||
      diff < 7200 && "1 hour ago" ||
      diff < 86400 && Math.floor( diff / 3600 ) + " hours ago") ||
    day_diff == 1 && "Yesterday" ||
    day_diff < 7 && day_diff + " days ago" ||
    day_diff < 31 && Math.ceil( day_diff / 7 ) + " weeks ago";
}

function padLeft(num, length) {
  var r = String(num);
  while (r.length < length) {
    r = '0' + r;
  }
  return r;
}

function formatDuration(duration) {
  duration /= 1000;
  var minutes = Math.floor(duration / 60);
  var seconds = Math.round(duration % 60);
  if (minutes < 60) {
    return padLeft(minutes, 2) + 'min ' + padLeft(seconds, 2) + 'sec';
  }
  return '';
}

var BuildStatus = function(db) {

  var api = {};
  var TESTS_TIMEOUT = 1000 * 60 * 60;

  function createResultRow(doc) {
    var started = new Date(doc.value.started);
    var completed = new Date(doc.value.completed);
    var resultsDocLink = '<a href="http://' + document.location.host +
      '/_utils/document.html?' + results_db_name + '/' + doc.id + '">' +
      doc.id + '<a>';
    var travisLink = '<a href="https://travis-ci.org/daleharvey/pouchdb/builds/' +
      doc.value.travis_job + '">' + doc.value.travis_job + '</a>';
    var row = document.createElement('tr');

    var status;
    if ('passed' in doc.value) {
      status = doc.value.passed ? 'pass' : 'fail';
    } else if ((new Date().getTime() - started.getTime()) < TESTS_TIMEOUT) {
      status = 'inprogress';
    } else {
      status = 'stalled';
    }

    var duration = status === 'inprogress' ? 'In Progress'
      : status === 'stalled' ? 'stalled'
      : formatDuration(completed - started);

    row.setAttribute('data-doc-id', doc.id);
    row.classList.add(status);
    row.insertAdjacentHTML('beforeend', '<td class="status"></td>');
    row.insertAdjacentHTML('beforeend', '<td>' + formatDate(started) + '</td>');
    row.insertAdjacentHTML('beforeend', '<td>' + duration + '</td>');
    row.insertAdjacentHTML('beforeend', '<td>' + doc.value.git_hash.substr(0, 7) + '</td>');
    row.insertAdjacentHTML('beforeend', '<td>' + resultsDocLink + '</td>');
    row.insertAdjacentHTML('beforeend', '<td>' + travisLink + '</td>');

    return row;
  }

  api.showAllRuns = function() {
    db.query('buildstatus/by_started', {descending: true}, function(err, result) {
      var tbody = document.createElement('tbody');
      tbody.setAttribute('id', 'results-table-body');
      result.rows.forEach(function(doc) {
        tbody.appendChild(createResultRow(doc));
      });
      document.getElementById('results-table')
          .replaceChild(tbody, document.getElementById('results-table-body'));
    });
  };

  api.showLastFail = function() {
    var opts = {descending: true, limit: 1, include_docs: true};
    db.query('buildstatus/by_fail', opts, function(err, result) {
      var doc = result.rows[0].doc;
      var failed = [];
      var dom = document.createElement('div');

      var resultsDocLink = '<a href="http://' + document.location.host +
        '/_utils/document.html?' + results_db_name + '/' + doc._id + '">' +
        formatDate(new Date(doc.started)) + '<a>';

      dom.insertAdjacentHTML('beforeend', resultsDocLink);

      for (var key in doc.runs) {
        if (doc.runs[key].passed === false) {
          doc.runs[key].key = key;
          failed.push(doc.runs[key]);
        }
      }
      failed.forEach(function(fail) {
        dom.insertAdjacentHTML('beforeend', '<h3>' + fail.key + '</h3>');
        if (!fail.report) {
          return;
        }
        fail.report.suites.forEach(function(suite) {
          if (suite.failures === 0) {
            return;
          }
          dom.insertAdjacentHTML('beforeend', '<pre>' + suite.stdout + '</pre>');
        });
      });

      document.getElementById('last-fail').appendChild(dom);
    });
  };

  return api;
};

new Pouch(results_db_name, function(err, db) {
  results_db = db;
  ui = new BuildStatus(results_db);
  ui.showAllRuns();
  ui.showLastFail();
});