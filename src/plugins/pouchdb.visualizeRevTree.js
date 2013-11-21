"use strict";
var visualizeRevTree = function(db) {
  var head = document.getElementsByTagName("head")[0];
  if (head) {
    var style = [
      ".visualizeRevTree{position: relative}",
      ".visualizeRevTree * {margin: 0; padding: 0; font-size: 10px}",
      ".visualizeRevTree line{stroke: #000; stroke-width: .10}",
      ".visualizeRevTree div{position: relative; }",
      ".visualizeRevTree circle{stroke: #000; stroke-width: .10}",
      ".visualizeRevTree circle.leaf{fill: green}",
      ".visualizeRevTree circle.winner{fill: red}",
      ".visualizeRevTree circle.deleted{fill: grey}",
      ".visualizeRevTree circle{transition: .3s}",
      ".visualizeRevTree circle.selected{stroke-width: .3}",
      ".visualizeRevTree div.box{background: #ddd; border: 1px solid #bbb; border-radius: 7px; padding: 7px; position: absolute;}",
      ".visualizeRevTree .editor {width: 220px}",
      ".visualizeRevTree .editor dt{width: 100px; height: 15px; float: left;}",
      ".visualizeRevTree .editor dd{width: 100px; height: 15px; float: left;}",
      ".visualizeRevTree .editor input{width: 100%; height: 100%}"
    ];
    var styleNode = document.createElement("style");
    styleNode.appendChild(document.createTextNode(style.join("\n")));
    head.appendChild(styleNode);
  }

  var grid = 10;
  var scale = 7;
  var r = 1;

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
    var com = 1;
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
        el.classList.add("leaf");
      }
      if (isWinner) {
        el.classList.add("winner");
      }
      if (isDeleted) {
        el.classList.add("deleted");
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
      linesBox.appendChild(el);
      return el;
    };
    var svgNS = "http://www.w3.org/2000/svg";
    var box = document.createElement('div');
    box.className = "visualizeRevTree";
    var svg = document.createElementNS(svgNS, "svg");
    box.appendChild(svg);
    var linesBox = document.createElementNS(svgNS, "g");
    svg.appendChild(linesBox);
    var circlesBox = document.createElementNS(svgNS, "g");
    svg.appendChild(circlesBox);
    var textsBox = document.createElementNS(svgNS, "g");
    svg.appendChild(textsBox);

    // first we need to download all data using public API
    var deleted = {};
    var winner;
    var allRevs = [];

    db.get(docId, function(err, doc){ // get winning revision here
      if (err) {
        callback(err);
        return;
      }
      winner = doc._rev;
      db.get(docId, {revs: true, open_revs: "all"}, function(err, results){
        if(err){
          callback(err);
          return;
        }
        var paths = [];
        results.forEach(function(res) {
          res = res.ok; // TODO: what about missing
          if (res._deleted) {
            deleted[res._rev] = true;
          }
          var revs = res._revisions;
          revs.ids.forEach(function(id, i) {
            var rev = (revs.start-i) + '-' + id;
            if (allRevs.indexOf(rev) === -1) {
              allRevs.push(rev);
            }
            i--;
          });
          var path = revs.ids.map(function(id, i) {
            return (revs.start-i) + '-' + id;
          });
          paths.push(path);
        });
        draw(paths);
      });
    });

    var focusedInput;
    function input(text){
      var div = document.createElement('div');
      div.classList.add('input');
      var span = document.createElement('span');
      div.appendChild(span);
      span.appendChild(document.createTextNode(text));
      var clicked = false;
      var input;

      div.ondblclick = function() {
        if(clicked){
          input.focus();
          return;
        }
        clicked = true;
        div.removeChild(span);
        input = document.createElement('input');
        div.appendChild(input);
        input.value = text;
        input.focus();

        input.onkeydown = function(e){
          if(e.keyCode === 9 && !e.shiftKey){
            var next;
            if(next = this.parentNode.parentNode.nextSibling){
              next.firstChild.ondblclick();
              e.preventDefault();
            }
          }
        };
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

        var click = function() {
          if (opened) return;
          opened = true;

          var div = document.createElement('div');
          div.classList.add("editor");
          div.classList.add("box");
          div.style.left = scale * (x + 3 * r) + "px";
          div.style.top = scale * (y - 2) + "px";
          div.style.zIndex = 1000;
          box.appendChild(div);

          var close = function() {
            div.parentNode.removeChild(div);
            opened = false;
          };

          db.get(docId, {rev: rev}, function(err, doc){
            var dl = document.createElement('dl');
            var keys = [];
            var addRow = function(key, value){
              var key = input(key);
              keys.push(key);
              var dt = document.createElement('dt');
              dt.appendChild(key);
              dl.appendChild(dt);
              var value = input(value);
              key.valueInput = value;
              var dd = document.createElement('dd');
              dd.appendChild(value);
              dl.appendChild(dd);
            };
            for (var i in doc) {
              if (doc.hasOwnProperty(i)) {
                addRow(i, JSON.stringify(doc[i]));
              }
            }
            div.appendChild(dl);
            var addButton = document.createElement('button');
            addButton.appendChild(document.createTextNode('add'));
            div.appendChild(addButton);
            addButton.onclick = function(){
              addRow('key', 'value');
            };
            var okButton = document.createElement('button');
            okButton.appendChild(document.createTextNode('ok'));
            div.appendChild(okButton);
            okButton.onclick = function() {
              var newDoc = {};
              keys.forEach(function(key){
                var value = key.valueInput.getValue();
                if (value.replace(/^\s*|\s*$/g, '')){
                  newDoc[key.getValue()] = JSON.parse(key.valueInput.getValue());
                }
              });
              putAfter(newDoc, doc._rev, function(err, ok){
                if (!err) {
                  close();
                } else {
                  console.error(err);
                  alert("error occured, see console");
                }
              });
            };
            var cancelButton = document.createElement('button');
            cancelButton.appendChild(document.createTextNode('cancel'));
            div.appendChild(cancelButton);
            cancelButton.onclick = close;
          });
        };
        nodeEl.onclick = click;
        nodeEl.onmouseover = function() {
          this.classList.add("selected");
          //text.style.display = "block";
        };
        nodeEl.onmouseout = function() {
          this.classList.remove("selected");
          //text.style.display = "none";
        };

        var text = document.createElement('div');
        //text.style.display = "none";
        text.classList.add("box");
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
        text.onclick = click;
        box.appendChild(text);
    }


    function draw(paths){
      var minUniq = minUniqueLength(allRevs);
      var maxX = grid;
      var maxY = grid;
      var levelCount = []; // numer of nodes on some level (pos)

      var map = {}; // map from rev to position
      var levelCount = [];

      function drawPath(path) {
        for (var i = 0; i < path.length; i++) {
          var rev = path[i];
          var isLeaf = i === 0;
          var pos = +rev.split('-')[0];

          if (!levelCount[pos]) {
            levelCount[pos] = 1;
          }
          var x = levelCount[pos] * grid;
          var y = pos * grid;

          if (!isLeaf) {
            var nextRev = path[i-1];
            var nextX = map[nextRev][0];
            var nextY = map[nextRev][1];

            if (map[rev]) {
              x = map[rev][0];
              y = map[rev][1];
            }

            line(x, y, nextX, nextY);
          }
          if (map[rev]) {
            break;
          }
          maxX = Math.max(x, maxX);
          maxY = Math.max(y, maxY);
          levelCount[pos]++;
          node(x, y, rev, isLeaf, rev in deleted, rev === winner, minUniq);
          map[rev] = [x, y];
        }
      }
      paths.forEach(drawPath);

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
