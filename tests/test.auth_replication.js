var remote = {
    host: 'localhost:1234'
};

module('auth_replication', {
    setup: function () {
        this.name = 'test_suite_db';
        this.remote = 'http://' + remote.host + '/test_suite_db/';
    }
});

function createAdminUser(callback) {
    // create admin user
    var adminuser = {
        _id: 'org.couchdb.user:adminuser',
        name: 'adminuser',
        type: 'user',
        password: 'password',
        roles: []
    };

    $.ajax({
        url: 'http://' + remote.host + '/_config/admins/adminuser',
        type: 'PUT',
        data: JSON.stringify(adminuser.password),
        processData: false,
        contentType: 'application/json',
        success: function () {
            login('adminuser', 'password', function (err) {
                if (err) {
                    return callback(err);
                }
                $.ajax({
                    url: 'http://' + remote.host + '/_users/' +
                         'org.couchdb.user%3Aadminuser',
                    type: 'PUT',
                    data: JSON.stringify(adminuser),
                    processData: false,
                    contentType: 'application/json',
                    dataType: 'json',
                    success: function (data) {
                        adminuser._rev = data.rev;

                        logout(function (err) {
                            if (err) {
                                return callback(err);
                            }
                            callback(null, adminuser);
                        });
                    },
                    error: function (err) {
                        callback(err);
                    }
                });
            });
        },
        error: function (err) {
            callback(err);
        }
    });
}

function deleteAdminUser(adminuser, callback) {
    $.ajax({
        type: 'DELETE',
        username: 'adminuser',
        password: 'password',
        beforeSend: function (xhr) {
            // TODO: this isn't working!
            xhr.withCredentials = true;
        },
        url: 'http://' + remote.host + '/_config/admins/adminuser',
        contentType: 'application/json',
        success: function () {
            $.ajax({
                username: 'adminuser',
                password: 'password',
                beforeSend: function (xhr) {
                    // TODO: this isn't working!
                    xhr.withCredentials = true;
                },
                withCredentials: true,
                type: 'DELETE',
                url: 'http://' + remote.host + '/_users/' +
                     'org.couchdb.user%3Aadminuser?rev=' + adminuser._rev,
                contentType: 'application/json',
                success: function () {
                    callback();
                },
                error: function (err) {
                    callback(err);
                }
            });
        },
        error: function (err) {
            callback(err);
        }
    });
}

function login(username, password, callback) {
    $.ajax({
        type: 'POST',
        url: 'http://' + remote.host + '/_session',
        data: JSON.stringify({name: username, password: password}),
        processData: false,
        contentType: 'application/json',
        success: function () {
            callback();
        },
        error: function (err) {
            callback(err);
        }
    });
}

function logout(callback) {
    $.ajax({
        type: 'DELETE',
        url: 'http://' + remote.host + '/_session',
        username: '_',
        password: '_',
        success: function () {
            callback();
        },
        error: function (err) {
            callback(err);
        }
    });
}


asyncTest("Replicate from DB as non-admin user", function() {
    // SEE: https://github.com/apache/couchdb/blob/master/share/www/script/couch_test_runner.js
    // - create new DB
    // - push docs to new DB
    // - add new admin user
    // - login as new admin user
    // - add new user (non admin)
    // - login as new user
    // - replicate from new DB
    // - login as admin user
    // - delete users and return to admin party
    // - delete original DB

    var self = this;

    var docs = [
        {_id: 'one', count: 1},
        {_id: 'two', count: 2}
    ];

    function cleanup() {
        deleteAdminUser(self.adminuser, function (err) {
            if (err) console.error(err);
            logout(function (err) {
                if (err) console.error(err);
                start();
            });
        });
    }

    // add user
    createAdminUser(function (err, adminuser) {
        if (err) console.error(err);

        self.adminuser = adminuser;

        login('adminuser', 'password', function (err) {
            if (err) console.error(err);

            initDBPair(this.name, this.remote, function(db, remote) {
                remote.bulkDocs({docs: docs}, {}, function(err, results) {
                    if (err) console.error(err);

                    // db.replicate.from doesn't call it's callback on error
                    // due to there being no proper error handling, so when
                    // this test fails it leaves the remote db in a
                    // non-admin-party mode. This timeout is used to finally
                    // end the test and take the remote db back to admin-party
                    // mode.

                    // TODO: When there is actually some proper error handling
                    // in pouch, update this test so it no longer relies on a
                    // timeout.

                    setTimeout(cleanup, 5000); // be generous so we don't cause
                                               // false test failures
                                               // (hopefully!)

                    // no longer in admin-party
                    db.replicate.from(self.remote, function(err, result) {
                        if (err) console.error(err);

                        db.allDocs(function(err, result) {
                            if (err) console.error(err);
                            ok(
                                result.rows.length === docs.length,
                                'correct # docs exist'
                            );
                            // wait for timeout so we don't call start()
                            // multiple times
                            //cleanup();
                        });
                    });
                });
            });

        });
    });

});
