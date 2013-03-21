chrome.app.runtime.onLaunched.addListener(function(){
	chrome.app.window.create("./tests/test.html", {
		"width": 800,
		"height": 800
	});
});
