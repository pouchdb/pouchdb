'use strict';
/* global jQuery,customBuildsInfo */

// UI for the "Custom Builds" page of PouchDB.com

var generateCode = require('./generateCode');
var generateName = require('./generateName');
var options = require('./options');

function setup($) {
  var optionsDiv = $('#custom-options');
  var codeDiv = $('#custom-code');
  var downloadBtn = $('#download-custom');
  var downloadMinBtn = $('#download-custom-min');

  options.forEach(function (option, i) {
    var id = 'custom-option-' + i;
    optionsDiv.append([
      $('<input type="checkbox"/>')
        .attr('id', id)
        .attr('checked', true),
      $('<label></label>')
        .text(option.name)
        .attr('for', id),
      $('<div></div>')
        .html(option.info)
        .attr('class', 'custom-option-info'),
      $('<br/>')
    ]);
  });

  function refresh() {
    var combo = [];
    $('#custom-options input').each(function (i, checkbox) {
      var $checkbox = $(checkbox);
      if ($checkbox.prop('checked')) {
        combo.push(options[i]);
      }
    });
    var name = generateName(combo);
    var code = generateCode(combo);
    var info = customBuildsInfo[name];

    codeDiv.text(
      "// PouchDB custom build for Browserify/Webpack.\n" +
      "// Just `npm install pouchdb`, include this\n" +
      "// script, and you're good to go!\n" +
      "// Generated on " + new Date().toDateString() + " from\n" +
      "// " + document.location.href + "\n" + code);

    downloadMinBtn.text('Download min (' +
      (Math.round(info.sizeGzipped / 100) / 10) + 'KB gzipped)')
      .attr('href', 'static/js/custom/pouchdb-custom-' + name + '.min.js');
    downloadBtn.attr('href',
      'static/js/custom/pouchdb-custom-' + name + '.js');
  }

  $('#custom-options input').change(refresh);
  refresh();
}

// wait for jQuery/customBuildsInfo to be loaded
var id = setInterval(function () {
  if (typeof jQuery === 'undefined' ||
      typeof customBuildsInfo === 'undefined') {
    return;
  }
  clearInterval(id);
  jQuery(setup);
}, 100);