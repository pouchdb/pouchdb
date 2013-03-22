chrome.app.runtime.onLaunched.addListener(function(){
	chrome.app.window.create("./tests/test.html", {
		"width": 1000,
		"height": 800
	});
});
