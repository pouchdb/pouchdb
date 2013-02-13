"use strict";
var visualizeRevTree = function(db) {

  var visualize = function(id, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
    }
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    var linesBox = document.createElementNS(svgNS, "g");
    svg.appendChild(linesBox);
    var circlesBox = document.createElementNS(svgNS, "g");
    svg.appendChild(circlesBox);
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

    db.get(id, {metadata: true}, function (err, res){
      metadata = res.metadata;
      var revs = res.metadata.rev_tree;
      var toVisit = [];

      console.log('res', res);
      revs.forEach(function(tree) {
        toVisit.push({pos: tree.pos, ids: tree.ids});
      });

      var grid = 10;
      var maxX = grid;
      var maxY = grid;
      var r = 1;
      var prevPos = 0;
      var posCount = 0; // count elements on current depth

      var winningRev = Pouch.merge.winningRev(metadata).split('-')[1];

      console.log('winner', winningRev);

      while (toVisit.length > 0) {
        console.log(toVisit);
        var node = toVisit.shift(),
            pos = node.pos,
            tree = node.ids,
            rev = tree[0],
            children = tree[1],
            isLeaf = (children.length === 0);

        if (prevPos != pos) {
          prevPos = pos;
          posCount = 0;
        } else {
          posCount++;
        }
        
        var x = posCount * grid;
        var y = pos * grid;
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        var nodeEl = circ(x, y, r, isLeaf, winningRev === rev);
        nodeEl.rev = rev;
        nodeEl.pos = pos;

        (function(nodeEl){
          console.log(nodeEl);
          db.get(id, {rev: nodeEl.pos + '-' + nodeEl.rev}, function(err, doc){
            if(doc._deleted) {
              nodeEl.style.stroke = "#999";
            }
          });
        })(nodeEl);

        nodeEl.onclick = function() {
          var that = this;
          //console.log(this.pos + '-' + this.rev);
          db.get(id, {rev: this.pos + '-' + this.rev}, function(err, doc){
            console.log(err, doc);
          });
        }
        if (node.parentY) {
          line(x, y, node.parentX, node.parentY); 
        }

        children.forEach(function(branch) {
          toVisit.push({pos: pos+1, ids: branch, parentX: x, parentY: y});
        });
      }
      svg.setAttribute('viewBox', (-grid) + ' 0 ' + (maxX + 2 * grid) + ' ' + (maxY + grid));
      call(callback, svg);
    });
  };

  return {'visualizeRevTree': visualize};
};
visualizeRevTree._delete = function(){};
Pouch.plugin('visualizeRevTree', visualizeRevTree);
