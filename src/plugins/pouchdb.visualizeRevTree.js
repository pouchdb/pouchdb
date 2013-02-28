"use strict";
var visualizeRevTree = function(db) {
  var grid = 10;
  var scale = 7;
  var r = 1;

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
  var revisionsToPath = function(revisions){
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
  };
  // returns minimal number i such that prefixes of lenght i are unique
  // ex: ["xyaaa", "xybbb", "xybccc"] -> 4
  var minUniqueLength = function(arr, len){
    function strCommon(a, b){
      if (a === b) return a.length;
      var i = 0;
      while(++i){
        if(a[i - 1] !== b[i - 1]) return i;
      }
    }
    var array = arr.slice(0);
    var com = 0;
    array.sort();
    for (var i = 1; i < array.length; i++){
      com = Math.max(com, strCommon(array[i], array[i - 1]));
    }
    return com;
  };

  var putAfter = function(doc, prevRev, callback){
    var newDoc = JSON.parse(JSON.stringify(doc));
    newDoc._revisions = {
      start: +newDoc._rev.split('-')[0],
      ids: [
        newDoc._rev.split('-')[1],
        prevRev.split('-')[1]
      ]
    };
    db.put(newDoc, {new_edits: false}, callback);
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
    var box = document.createElement('div');
    box.setAttribute('position', 'relative');
    var svg = document.createElementNS(svgNS, "svg");
    box.appendChild(svg);
    var linesBox = document.createElementNS(svgNS, "g");
    svg.appendChild(linesBox);
    var circlesBox = document.createElementNS(svgNS, "g");
    svg.appendChild(circlesBox);
    var textsBox = document.createElementNS(svgNS, "g");
    svg.appendChild(textsBox);

    // first we need to download all data using public API
    var tree = [];
    var deleted = {};
    var winner;
    var allRevs = [];

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
            res._revisions.ids.forEach(function(rev){
              if (allRevs.indexOf(rev) === -1) {
                allRevs.push(rev);
              }
            });
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

    function input(text){
      var div = document.createElement('div');
      var span = document.createElement('span');
      div.appendChild(span);
      span.appendChild(document.createTextNode(text));
      var clicked = false;
      var input;

      div.ondblclick = function() {
        clicked = true;
        div.removeChild(span);
        input = document.createElement('input');
        div.appendChild(input);
        input.value = text;
      };
      div.getValue = function() {
        return clicked ? input.value : text;
      };
      return div;
    }

    function node(x, y, rev, isLeaf, isDeleted, isWinner, shortDescLen){
        var nodeEl = circ(x, y, r, isLeaf, rev in deleted, rev === winner);
        var pos = rev.split('-')[0];
        var id = rev.split('-')[1];
        var opened = false;

        nodeEl.rev = rev;
        nodeEl.onclick = function() {
          var div = document.createElement('div');
          div.style.background = "#ddd";
          div.style.padding = "8px";
          div.style.border = "#aaa";
          div.style.borderRadius = "7px";
          div.style.position = "absolute";
          div.style.left = scale * (x + 3 * r) + "px";
          div.style.top = scale * (y - 2) + "px";
          div.style.zIndex = 1000;
          box.appendChild(div);

          if (opened) return;
          opened = true;
          var that = this;
          db.get(docId, {rev: this.rev}, function(err, doc){
            var newValues = {};
            var keys = [];
            for (var i in doc) {
              if (doc.hasOwnProperty(i)) {
                var key = input(i);
                keys.push(key);
                div.appendChild(key);
                var value = input(JSON.stringify(doc[i]));
                div.appendChild(value);
              }
            }
            var okButton = document.createElement('button');
            okButton.appendChild(document.createTextNode('ok'));
            div.appendChild(okButton);
            okButton.onclick = function() {
              var newDoc = {};
              keys.forEach(function(key){
                console.log(key.nextSibling.getValue());
                newDoc[key.getValue()] = JSON.parse(key.nextSibling.getValue());
              });
              putAfter(newDoc, doc._rev, function(err, ok){
                console.log(err, ok);
              });
            };
            var cancelButton = document.createElement('button');
            cancelButton.appendChild(document.createTextNode('cancel'));
            div.appendChild(cancelButton);
            cancelButton.onclick = function() {
              div.parentNode.removeChild(div);
              opened = false;
            };
          });
        };
        nodeEl.onmouseover = function() {
          this.setAttribute('r', 1.2);
          //text.style.display = "block";
        };
        nodeEl.onmouseout = function() {
          this.setAttribute('r', 1);
          //text.style.display = "none";
        };

        var text = document.createElement('div');
        //text.style.display = "none";
        text.style.background = "#ddd";
        text.style.padding = "8px";
        text.style.border = "#aaa";
        text.style.borderRadius = "7px";
        text.style.position = "absolute";
        text.style.fontSize = "10px";
        text.style.left = scale * (x + 3 * r) + "px";
        text.style.top = scale * (y - 2) + "px";
        text.short = pos + '-' + id.substr(0, shortDescLen);
        text.long = pos + '-' + id;
        text.appendChild(document.createTextNode(text.short));
        text.onmouseover = function() {
          this.style.zIndex = 1000;
        };
        text.onmouseout = function() {
          this.style.zIndex = 1;
        };
        box.appendChild(text);
    }

    function draw(forest){
      var minUniq = minUniqueLength(allRevs);
      var maxX = grid;
      var maxY = grid;
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

        node(x, y, rev, isLeaf, rev in deleted, rev === winner, minUniq);


        if (ctx) {
          line(x, y, ctx.x, ctx.y); 
        }
        return {x: x, y: y};
      });
      svg.setAttribute('viewBox', '0 0 ' + (maxX + grid) + ' ' + (maxY + grid));
      svg.style.width = scale * (maxX + grid) + 'px';
      svg.style.height = scale * (maxY + grid) + 'px';
      callback(null, box);
    }
  };
  return {'visualizeRevTree': visualize};
};
visualizeRevTree._delete = function(){};
Pouch.plugin('visualizeRevTree', visualizeRevTree);
