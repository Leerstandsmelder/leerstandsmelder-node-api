#!/usr/bin/env node

"use strict";

var Promise = require('bluebird'),
    mongoose = require('mongoose'),
    config = require('../config.json');

mongoose.Promise = Promise;

Promise.coroutine(function* () {
    
    if (!config) {
        throw new Error('Server has not been configured yet. Please run bin/setup.');
    }
    let dburl = 'mongodb://' +
        config.mongodb.host + ':' +
        config.mongodb.port + '/' +
        config.mongodb.dbname;
    mongoose.connect(dburl, {useMongoClient: true});
    let userSchema = require('../models/user').User;
    mongoose.model('User', userSchema);

    let argv = require('yargs')
        .string('year')
        .argv;

    if(argv.year && Number.isInteger(parseInt(argv.year))) {
        console.log('Year:', argv.year)

        let result = yield mongoose.model('User', userSchema, 'users', true).find({$and: [{created: { $gte: argv.year + "-01-01", $lte: argv.year + "-12-31" }}, {confirmed: false}]});
        console.log('Number of user records found: ', result.length);
        
        if (Array.isArray(result)) {
            for (let i = 0; i < result.length; i+=1) {
                let user = result[i];
                user.resendConfirmationMail();
                console.log('Resend mail to: ', user.email);
            }
        }   
        process.exit(0);
    
    } else {
        console.log('Parameter --year must be set and be a vaild number');
        process.exit(1);
    }

    
})()
.catch(function (err) {
    console.log('Error updating user:', err.message);
    process.exit(1);
});