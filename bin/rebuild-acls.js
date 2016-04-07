#!/usr/bin/env node

'use strict';

var Promise = require('bluebird'),
    mongoose = require('mongoose'),
    config = require('../lib/config'),
    acl = require('../lib/auth/acl-manager');

mongoose.Promise = Promise;

Promise.coroutine(function* () {
    yield config.load();
    var resources = [
            {res: 'Comment', path: '/comments', model: require('../models/comment').Comment},
            {res: 'Location', path: '/locations', model: require('../models/location').Location},
            {res: 'Region', path: '/regions', model: require('../models/region').Region},
            {res: 'Photo', path: '/photos', model: require('../models/photo').Photo},
            {res: 'Post', path: '/posts', model: require('../models/post').Post},
            {res: 'User', path: '/users', model: require('../models/user').User}
        ],
        dburl = 'mongodb://' +
        config.get.mongodb.host + ':' +
        config.get.mongodb.port + '/' +
        config.get.mongodb.dbname;

    console.log('connecting to ' + dburl);
    return new Promise(function (resolve) {
            mongoose.connect(dburl);
            mongoose.connection.on('connected', function () {
                for (var r of resources) {
                    mongoose.model(r.res, r.model);
                }
                mongoose.model('AclEntry', require('../models/acl-entry').AclEntry);
                console.log('connected to mongodb!');
                resolve();
            });
        })
        .then(() => {
            return Promise.map(resources, (resource) => {
                console.log('Setting ACLs for ' + resource.res);
                return mongoose.model(resource.res).find({})
                    .then((results) => {
                        return results;
                    })
                    .map((item) => {
                        var acls = ['admin'];
                        if (item.user_uuid) {
                            acls.push(item.user_uuid);
                        }
                        if (resource.res === 'Post') {
                            acls.push('editor');
                        }
                        if (resource.res === 'User') {
                            yield acl.setAclEntry('/users/' + user.uuid, ['user'], ['get']);
                            return acl.setAclEntry('/users/me', acls, ['get', 'put', 'delete']);
                        } else {
                            return acl.setAclEntry(resource.path + '/' + item.uuid, acls, ['get', 'put', 'delete']);
                        }
                    }, {concurrency: 1});
            }, {concurrency: 1});
        })
        .then(() => {
            console.log('done.');
            process.exit(0);
        });
})();