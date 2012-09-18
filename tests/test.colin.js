['idb-1'].map(function(adapter) {

  module('colin: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
    }
  });



/*asyncTest("Colin Test remove doc with attachment", function() {
    initTestDB(this.name, function(err, db) {
      db.put({ _id: 'mydoc' }, function(err, resp) {
        db.putAttachment('mydoc/mytext', resp.rev, 'Mytext', 'text/plain', function(err, res) {
			db.get('mydoc',{attachments:false},function(err,doc){
				  db.remove(doc, function(err, resp){
					ok(res.ok);
					start();
				  }); 
				});             
			});
      	});
    });
  });*/
  
asyncTest("Colin Test large attachment", function() {
	var fiveMB="";
	for (i=0;i<5000000;i++){ //not sure if this is exactly 5MB but it's big enough
		fiveMB+="a";
	}
	
	var fiveMB2="";
	for (i=0;i<5000000;i++){
		fiveMB2+="b";
	}
	
	initTestDB(this.name, function(err, db) {
		var queryStartTime1=new Date().getTime();
		function map(doc){
			{emit(null, doc);} 
		}        
		db.query({map: map},{reduce: false}, function(err, response) {				          
			var duration1=   new Date().getTime()-queryStartTime1;
			console.log("query 1 took "+duration1+" ms");
			
				db.put({ _id: 'mydoc' }, function(err, resp) {
				db.putAttachment('mydoc/mytext', resp.rev, fiveMB, 'text/plain', function(err, res) {			
					db.put({ _id: 'mydoc2' }, function(err, resp) {
						db.putAttachment('mydoc/mytext2', resp.rev, fiveMB2, 'text/plain', function(err, res) {
							var queryStartTime2=new Date().getTime();
							function map(doc){
								{emit(null, doc);} 
							}        
							db.query({map: map},{reduce: false}, function(err, response) {				          
								var duration2=   new Date().getTime()-queryStartTime2;
								console.log("query 2 took "+duration2+" ms");
								ok(duration2<=duration1*10); //make sure we are still within 1 order of magnitude 
								start();
							}); 
						});
					});
				});
			});
			
			
		}); 
	
	
		
	});
});
  
});

