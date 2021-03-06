'use strict';

var mongoose = require('mongoose');

module.exports.setAclEntry = (resource, user, action) => {
    if (!Array.isArray(user)) {
        user = [user];
    }
    if (!Array.isArray(action)) {
        action = [action];
    }
    return mongoose.model('AclEntry').findOne({resource_key: resource, role_key: user})
        .then(function (entry) {
            if (!entry) {
                entry = {
                    resource_key: resource,
                    role_key: user,
                    actions: []
                };
            }
            for (var i = 0; i < action.length; i += 1) {
                if (entry.actions.indexOf(action[i]) < 0) {
                    entry.actions.push(action[i]);
                }
            }
            return mongoose.model('AclEntry').findOneAndUpdate({
                resource_key: resource,
                role_key: user
            }, entry, {upsert:true, new:true});
        });
};

module.exports.removeAclEntry = (resource, user, action) => {
    return mongoose.model('AclEntry').findOne({resource_key: resource, role_key: user})
        .then(function (entry) {
            if (entry) {
                if (action === '*') {
                    entry.actions = [];
                } else {
                    if (entry.actions.indexOf(action) > -1) {
                        entry.actions = entry.actions.splice(entry.actions.indexOf(action), 1);
                    }
                }
                if (entry.actions.length === 0) {
                    return mongoose.model('AclEntry').findOneAndRemove({resource_key: resource, role_key: user});
                } else {
                    return entry.save();
                }
            }
        });
};

module.exports.isAllowed = (resource, roles, action) => {
    if (!Array.isArray(roles)) {
        roles = [roles];
    }
    roles = roles.map(function (item) {
        item = {role_key: item};
        return item;
    });
    return mongoose.model('AclEntry').find({ resource_key: resource, $or: roles })
        .then(function (entries) {
            if (!entries || entries.length === 0) {
                return false;
            }
            var found = false;
            for (var key in entries) {
                if (entries[key].actions.indexOf(action.toLowerCase()) > -1) {
                    found = true;
                }
            }
            return found;
        });
};