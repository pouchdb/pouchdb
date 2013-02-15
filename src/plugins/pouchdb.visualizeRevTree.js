"use strict";
var visualizeRevTree = function(db) {
  var visualize = function(docId, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
    }
    var circ = function(x, y, r, isLeaf, isWinner, isDeleted) {
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
    tree = [];

    db.get(docId, {open_revs: "all"}, function(err, res){
      if(err){
        call(callback, Pouch.Errors.MISSING_DOC);
        return;
      }
      var len = res.length;
      res.forEach(function(res){
        db.get(docId, {rev: res.ok._rev, revs: true}, function(err, res){
          //console.log('revisions', res._revisions);
          path = revisionsToPath(res._revisions);
          //console.log(path);

          tree = Pouch.merge(tree, path).tree;
          len--;
          if (len == 0){
            draw(tree);
          }
        });
      });
    });

    function draw(forest){
      console.log('forest', forest);
      var toVisit = [];

      var grid = 10;
      var maxX = grid;
      var maxY = grid;
      var r = 1;

      var winningRev = 0; //Pouch.merge.winningRev(metadata).split('-')[1];

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

        var nodeEl = circ(x, y, r, isLeaf);
        nodeEl.rev = rev;
        nodeEl.pos = pos;

        nodeEl.onclick = function() {
          var that = this;
          //console.log(this.pos + '-' + this.rev);
          db.get(docId, {rev: this.rev}, function(err, doc){
            console.log(err, doc);
          });
        }
        if (ctx) {
          line(x, y, ctx.x, ctx.y); 
        }
        return {x: x, y:y};
      });
      svg.setAttribute('viewBox', (-grid) + ' 0 ' + (maxX + 2 * grid) + ' ' + (maxY + grid));
      call(callback, null, svg);
    }
  }

  return {'visualizeRevTree': visualize};
};
visualizeRevTree._delete = function(){};
Pouch.plugin('visualizeRevTree', visualizeRevTree);
