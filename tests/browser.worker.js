describe('worker', function () {

  it('create it', function(done){
    var worker = new Worker('worker.js');
    worker.addEventListener('message',function(e){
      e.data.should.equal('pong');
      worker.terminate();
      done();
    });
    worker.postMessage('ping');
  });
  it('check pouch version', function(done){
    var worker = new Worker('worker.js');
    worker.addEventListener('message',function(e){
      PouchDB.version.should.equal(e.data);
      worker.terminate();
      done();
    });
    worker.postMessage('version');
  });
  it('create remote db', function(done){
    var worker = new Worker('worker.js');
    worker.addEventListener('error',function(e){
      throw e;
    });
    worker.addEventListener('message',function(e){
      e.data.should.equal('lala');
      worker.terminate();
      done();
    });
    worker.postMessage(['create',testUtils.generateAdapterUrl('http-1')]);
  });
  if (typeof mozIndexedDB === 'undefined') {
    it('create local db', function(done){
      var worker = new Worker('worker.js');
      worker.addEventListener('error',function(e){
        throw e;
      });
      worker.addEventListener('message',function(e){
        e.data.should.equal('lala');
        worker.terminate();
        done();
      });
      worker.postMessage(['create',testUtils.generateAdapterUrl('local-1')]);
    });
  }
});