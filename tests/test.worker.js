QUnit.module('worker');

asyncTest('create it',1,function(){
  var worker = new Worker('worker.js');
  worker.addEventListener('message',function(e){
    ok('pong',e.data);
    worker.terminate();
    start();
  });
  worker.postMessage('ping');
});
asyncTest('check pouch version',1,function(){
  var worker = new Worker('worker.js');
  worker.addEventListener('message',function(e){
    ok(PouchDB.version,e.data);
    worker.terminate();
    start();
  });
  worker.postMessage('version');
});
asyncTest('create remote db',1,function(){
  var worker = new Worker('worker.js');
  worker.addEventListener('error',function(e){
    throw e;
  });
  worker.addEventListener('message',function(e){
    ok('lala',e.data);
    worker.terminate();
    start();
  });
  worker.postMessage(['create',testUtils.generateAdapterUrl('http-1')]);
});
asyncTest('create local db',1,function(){
  var worker = new Worker('worker.js');
  worker.addEventListener('error',function(e){
    throw e;
  });
  worker.addEventListener('message',function(e){
    ok('lala',e.data);
    worker.terminate();
    start();
  });
  worker.postMessage(['create',testUtils.generateAdapterUrl('local-1')]);
});