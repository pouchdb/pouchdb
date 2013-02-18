"use strict";
var visualizeRevTree = function(db) {
  // see: pouch.utils.js
  var traverseRevTree = function(revs, callback) {
    var toVisit = [];

    revs.forEach(function(tree) {
      toVisit.push({pos: tree.pos, ids: tree.ids});
    });

    while (toVisit.length > 0) {
      var node = toVisit.pop(),
      pos = node.pos,
      tree = node.ids;
      var newCtx = callback(tree[1].length === 0, pos, tree[0], node.ctx);
      tree[1].forEach(function(branch) {
        toVisit.push({pos: pos+1, ids: branch, ctx: newCtx});
      });
    }
  };

  var visualize = function(docId, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
    }
    var circ = function(x, y, r, isLeaf, isDeleted, isWinner) {
      var el = document.createElementNS(svgNS, "circle");
      el.setAttributeNS(null, "cx", x);
      el.setAttributeNS(null, "cy", y);
      el.setAttributeNS(null, "r", r);
      if (isLeaf) {
        el.setAttributeNS(null, "fill", "green");
      }
      if (isWinner) {
        el.setAttributeNS(null, "fill", "red");
      }
      if (isDeleted) {
        el.setAttributeNS(null, "stroke", "grey");
      }
      circlesBox.appendChild(el);
      return el;
    };
    var line = function(x1, y1, x2, y2) {
      var el = document.createElementNS(svgNS, "line");
      el.setAttributeNS(null, "x1", x1);
      el.setAttributeNS(null, "y1", y1);
      el.setAttributeNS(null, "x2", x2);
      el.setAttributeNS(null, "y2", y2);
      el.setAttributeNS(null, "stroke", "#000");
      el.setAttributeNS(null, "stroke-width", ".25");
      linesBox.appendChild(el);
      return el;
    };
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    var linesBox = document.createElementNS(svgNS, "g");
    svg.appendChild(linesBox);
    var circlesBox = document.createElementNS(svgNS, "g");
    svg.appendChild(circlesBox);

    function revisionsToPath(revisions){
      var tree = [revisions.ids[0], []];
      var i, rev;
      for(i = 1; i < revisions.ids.length; i++){
        rev = revisions.ids[i];
        tree = [rev, [tree]];
      }
      return {
        pos: revisions.start - revisions.ids.length + 1,
        ids: tree
      };
    }

    // first we need to download all data using public API
    var tree = [];
    var deleted = {};
    var winner;

    // consider using revs=true&open_revs=all to get everything in one query
    db.get(docId, function(err, doc){ // get winning revision here
      if (err) {
        callback(err);
        return;
      }
      winner = doc._rev;
      db.get(docId, {open_revs: "all"}, function(err, results){ // get all leaves
        if(err){
          callback(err);
          return;
        }
        var len = results.length;
        results.forEach(function(res){
          if (res.ok._deleted) {
            deleted[res.ok._rev] = true;
          }
          db.get(docId, {rev: res.ok._rev, revs: true}, function(err, res){ // get the whole branch of current leaf
            var path = revisionsToPath(res._revisions);
            tree = Pouch.merge(tree, path).tree;
            len--;
            if (len === 0){
              draw(tree);
            }
          });
        });
      });
    });

    function draw(forest){
      var grid = 10;
      var maxX = grid;
      var maxY = grid;
      var r = 1;
      var levelCount = []; // numer of nodes on some level (pos)
      traverseRevTree(forest, function(isLeaf, pos, id, ctx) {
        if (!levelCount[pos]) {
          levelCount[pos] = 1;
        } else {
          levelCount[pos]++;
        }

        var rev = pos + '-' + id;
        var x = levelCount[pos] * grid;
        var y = pos * grid;
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        var nodeEl = circ(x, y, r, isLeaf, rev in deleted, rev === winner);
        nodeEl.rev = rev;
        nodeEl.pos = pos;
        nodeEl.onclick = function() {
          var that = this;
          db.get(docId, {rev: this.rev}, function(err, doc){
            console.log(that.rev, err, doc);
          });
        };
        if (ctx) {
          line(x, y, ctx.x, ctx.y); 
        }
        return {x: x, y: y};
      });
      svg.setAttribute('viewBox', '0 0 ' + (maxX + grid) + ' ' + (maxY + grid));
      callback(null, svg);
    }
  };
  return {'visualizeRevTree': visualize};
};
visualizeRevTree._delete = function(){};
Pouch.plugin('visualizeRevTree', visualizeRevTree);
