#!/usr/bin/env node

'use strict';

var Promise = require('bluebird'),
    mongoose = require('mongoose'),
    config = require('../config.json'),
    acl = require('../lib/auth/acl-manager');

mongoose.Promise = Promise;

var resources = [
        {res: 'Location', path: '/locations', model: require('../models/location').Location},
        {res: 'Region', path: '/regions', model: require('../models/region').Region},
        {res: 'Post', path: '/posts', model: require('../models/post').Post}
    ],
    dburl = 'mongodb://' +
        config.mongodb.host + ':' +
        config.mongodb.port + '/' +
        config.mongodb.dbname;

console.log('connecting to ' + dburl);
return new Promise(function (resolve) {
    mongoose.connect(dburl);
    mongoose.connection.on('connected', function () {
        for (var r of resources) {
            mongoose.model(r.res, r.model);
        }
        acl.init(mongoose.connection.db);
        console.log('connected to mongodb!');
        resolve();
    });
})
    .then(() => {
        return Promise.map(resources, (resource) => {
            console.log('Updating slugs for ' + resource.res);
            return Promise.resolve()
                .then(() => {
                    return mongoose.model(resource.res).find({});
                })
                .map((item) => {
                    item.updateSlug();
                    console.log('new slug:', item.slug);
                    return item.save();
                }, {concurrency: 1});
        }, {concurrency: 1});
    })
    .then(() => {
        console.log('done.');
        process.exit(0);
    });
