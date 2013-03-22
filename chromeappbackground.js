chrome.app.runtime.onLaunched.addListener(function(){
	chrome.app.window.create("./tests/testWrapper.html", {
		"width": 1000,
		"height": 800
	});
});
