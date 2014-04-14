Cordova unit test runner for pouchdb
==================================================

With cordova unit test runner for pouchdb you can run pouchdb unit tests using mobile device. Currently only ios and android emulator and devices are tested and documented.

Before running the tests
-------------

1. [Install cordova](http://cordova.apache.org/docs/en/3.3.0/guide_cli_index.md.html)
2. Install SDKs for the platforms that you plan to test. For example, to test on android you must first [install android sdk](https://developer.android.com/tools/index.html) and then [install android virtual device](http://developer.android.com/tools/devices/managing-avds-cmdline.html).
3. After cloning this repo you must add platforms to the tests_cordova project. For example, if you have ios and android SDKs installed then you can add platforms with commands:
```
cd tests_cordova
cordova platform add android
cordova platforms add ios
```


How to run the tests
-------------

* Build pouchdb
* Ensure that couchdb is running in localhost:5984
* Run tests in an emulator `cordova emulate android` or you can also use a real device `cordova run ios`
* After a while the emulator is started and test runner is loaded. Now you can see the test runner. ![Start screen](https://raw.github.com/spMatti/pouchdb/master/tests_cordova/doc/images/android_start.png "Start screen")
* From the dropdown you can select what tests are run. ![Select tests](https://raw.github.com/spMatti/pouchdb/master/tests_cordova/doc/images/android_select_test.png "Select tests")
* Click "run tests" and you will see the qunit test runner. You can use the back button to return to the start screen. ![Run tests](https://raw.github.com/spMatti/pouchdb/master/tests_cordova/doc/images/android_run.png "Run tests")


Possible problems
-------------

Test runner uses symbolic links to tests and dists folders. The default security settings in Windows Vista/Windows 7 disallow non-elevated administrators and all non-administrators from creating symbolic links ([source](http://en.wikipedia.org/wiki/NTFS_symbolic_link)). 

TODO list
-------------

I had some network timeout problems with android emulator when all tests are run. I have to check what's the problem.
