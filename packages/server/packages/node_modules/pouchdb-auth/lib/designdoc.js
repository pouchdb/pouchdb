/* global isArray */
/* eslint no-redeclare: 0 */

//to update: http://localhost:5984/_users/_design/_auth & remove _rev.

/* istanbul ignore next */
module.exports = {
  _id: "_design/_auth",
  language: "javascript",
  validate_doc_update: function(newDoc, oldDoc, userCtx, secObj) {
    if (newDoc._deleted === true) {
      // allow deletes by admins and matching users
      // without checking the other fields
      if ((userCtx.roles.indexOf('_admin') !== -1) ||
        (userCtx.name == oldDoc.name)) {
        return;
      } else {
        throw({forbidden: 'Only admins may delete other user docs.'});
      }
    }

    if ((oldDoc && oldDoc.type !== 'user') || newDoc.type !== 'user') {
      throw({forbidden : 'doc.type must be user'});
    } // we only allow user docs for now

    if (!newDoc.name) {
      throw({forbidden: 'doc.name is required'});
    }

    if (!newDoc.roles) {
      throw({forbidden: 'doc.roles must exist'});
    }

    if (!isArray(newDoc.roles)) {
      throw({forbidden: 'doc.roles must be an array'});
    }

    for (var idx = 0; idx < newDoc.roles.length; idx++) {
      if (typeof newDoc.roles[idx] !== 'string') {
        throw({forbidden: 'doc.roles can only contain strings'});
      }
    }

    if (newDoc._id !== ('org.couchdb.user:' + newDoc.name)) {
      throw({
        forbidden: 'Doc ID must be of the form org.couchdb.user:name'
      });
    }

    if (oldDoc) { // validate all updates
      if (oldDoc.name !== newDoc.name) {
        throw({forbidden: 'Usernames can not be changed.'});
      }
    }

    if (newDoc.password_sha && !newDoc.salt) {
      throw({
        forbidden: 'Users with password_sha must have a salt.' +
          'See /_utils/script/couch.js for example code.'
      });
    }

    var is_server_or_database_admin = function(userCtx, secObj) {
      // see if the user is a server admin
      if(userCtx.roles.indexOf('_admin') !== -1) {
        return true; // a server admin
      }

      // see if the user a database admin specified by name
      if(secObj && secObj.admins && secObj.admins.names) {
        if(secObj.admins.names.indexOf(userCtx.name) !== -1) {
          return true; // database admin
        }
      }

      // see if the user a database admin specified by role
      if(secObj && secObj.admins && secObj.admins.roles) {
        var db_roles = secObj.admins.roles;
        for(var idx = 0; idx < userCtx.roles.length; idx++) {
          var user_role = userCtx.roles[idx];
          if(db_roles.indexOf(user_role) !== -1) {
            return true; // role matches!
          }
        }
      }

      return false; // default to no admin
    }

    if (!is_server_or_database_admin(userCtx, secObj)) {
      if (oldDoc) { // validate non-admin updates
        if (userCtx.name !== newDoc.name) {
          throw({
            forbidden: 'You may only update your own user document.'
          });
        }
        // validate role updates
        var oldRoles = oldDoc.roles.sort();
        var newRoles = newDoc.roles.sort();

        if (oldRoles.length !== newRoles.length) {
          throw({forbidden: 'Only _admin may edit roles'});
        }

        for (var i = 0; i < oldRoles.length; i++) {
          if (oldRoles[i] !== newRoles[i]) {
            throw({forbidden: 'Only _admin may edit roles'});
          }
        }
      } else if (newDoc.roles.length > 0) {
        throw({forbidden: 'Only _admin may set roles'});
      }
    }

    // no system roles in users db
    for (var i = 0; i < newDoc.roles.length; i++) {
      if (newDoc.roles[i][0] === '_') {
        throw({
          forbidden:
          'No system roles (starting with underscore) in users db.'
        });
      }
    }

    // no system names as names
    if (newDoc.name[0] === '_') {
      throw({forbidden: 'Username may not start with underscore.'});
    }

    var badUserNameChars = [':'];

    for (var i = 0; i < badUserNameChars.length; i++) {
      if (newDoc.name.indexOf(badUserNameChars[i]) >= 0) {
        throw({forbidden: 'Character `' + badUserNameChars[i] +
            '` is not allowed in usernames.'});
      }
    }
  }.toString()
}
