/* global log, isArray */

module.exports = {
  _id: "_design/_replicator",
  language: "javascript",
  validate_doc_update: function (newDoc, oldDoc, userCtx) {
    function reportError(error_msg) {
      log('Error writing document `' + newDoc._id +
        '\' to the replicator database: ' + error_msg);
      throw ({forbidden: error_msg});
    }

    function validateEndpoint(endpoint, fieldName) {
      if ((typeof endpoint !== 'string') &&
        ((typeof endpoint !== 'object') || (endpoint === null))) {

        reportError('The `' + fieldName + '\' property must exist' +
          ' and be either a string or an object.');
      }

      if (typeof endpoint === 'object') {
        if ((typeof endpoint.url !== 'string') || !endpoint.url) {
          reportError('The url property must exist in the `' +
            fieldName + '\' field and must be a non-empty string.');
        }

        if ((typeof endpoint.auth !== 'undefined') &&
          ((typeof endpoint.auth !== 'object') ||
            endpoint.auth === null)) {

          reportError('`' + fieldName +
            '.auth\' must be a non-null object.');
        }

        if ((typeof endpoint.headers !== 'undefined') &&
          ((typeof endpoint.headers !== 'object') ||
            endpoint.headers === null)) {

          reportError('`' + fieldName +
            '.headers\' must be a non-null object.');
        }
      }
    }

    var isReplicator = (userCtx.roles.indexOf('_replicator') >= 0);
    var isAdmin = (userCtx.roles.indexOf('_admin') >= 0);

    if (oldDoc && !newDoc._deleted && !isReplicator &&
      (oldDoc._replication_state === 'triggered')) {
      reportError('Only the replicator can edit replication documents ' +
        'that are in the triggered state.');
    }

    if (!newDoc._deleted) {
      validateEndpoint(newDoc.source, 'source');
      validateEndpoint(newDoc.target, 'target');

      if ((typeof newDoc.create_target !== 'undefined') &&
        (typeof newDoc.create_target !== 'boolean')) {

        reportError('The `create_target\' field must be a boolean.');
      }

      if ((typeof newDoc.continuous !== 'undefined') &&
        (typeof newDoc.continuous !== 'boolean')) {

        reportError('The `continuous\' field must be a boolean.');
      }

      if ((typeof newDoc.doc_ids !== 'undefined') &&
        !isArray(newDoc.doc_ids)) {

        reportError('The `doc_ids\' field must be an array of strings.');
      }

      if ((typeof newDoc.filter !== 'undefined') &&
        ((typeof newDoc.filter !== 'string') || !newDoc.filter)) {

        reportError('The `filter\' field must be a non-empty string.');
      }

      if ((typeof newDoc.query_params !== 'undefined') &&
        ((typeof newDoc.query_params !== 'object') ||
          newDoc.query_params === null)) {

        reportError('The `query_params\' field must be an object.');
      }

      if (newDoc.user_ctx) {
        var user_ctx = newDoc.user_ctx;

        if ((typeof user_ctx !== 'object') || (user_ctx === null)) {
          reportError('The `user_ctx\' property must be a ' +
            'non-null object.');
        }

        if (!(user_ctx.name === null ||
          (typeof user_ctx.name === 'undefined') ||
          ((typeof user_ctx.name === 'string') &&
            user_ctx.name.length > 0))) {

          reportError('The `user_ctx.name\' property must be a ' +
            'non-empty string or null.');
        }

        if (!isAdmin && (user_ctx.name !== userCtx.name)) {
          reportError('The given `user_ctx.name\' is not valid');
        }

        if (user_ctx.roles && !isArray(user_ctx.roles)) {
          reportError('The `user_ctx.roles\' property must be ' +
            'an array of strings.');
        }

        if (!isAdmin && user_ctx.roles) {
          for (var i = 0; i < user_ctx.roles.length; i++) {
            var role = user_ctx.roles[i];

            if (typeof role !== 'string' || role.length === 0) {
              reportError('Roles must be non-empty strings.');
            }
            if (userCtx.roles.indexOf(role) === -1) {
              reportError('Invalid role (`' + role +
                '\') in the `user_ctx\'');
            }
          }
        }
      } else {
        if (!isAdmin) {
          reportError('The `user_ctx\' property is missing (it is ' +
             'optional for admins only).');
        }
      }
    } else {
      if (!isAdmin) {
        if (!oldDoc.user_ctx || (oldDoc.user_ctx.name !== userCtx.name)) {
          reportError('Replication documents can only be deleted by ' +
            'admins or by the users who created them.');
        }
      }
    }
  }.toString()
};
