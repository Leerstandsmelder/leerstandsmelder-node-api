#!/usr/bin/env node

'use strict';

var async = require('async'),
    prompt = require('prompt');

prompt.message = "";
prompt.delimiter = "";
prompt.start();

async.waterfall([
    function (cb) {
        console.log('\nWelcome to the Leerstandsmelder API Server setup.'.yellow);
        loadConfig(cb);
    },
    function (config, cb) {
        if (config) {
            cb(null);
        } else {
            initialSetup(cb);
        }
    },
    function (cb) {
        createAdminUser(cb);
    }
], function (err) {
    console.log('\n');
    if (err) {
        console.log('Leerstandsmelder API Server setup failed.'.red, err);
        process.exit(1);
    } else {
        console.log('Leerstandsmelder API Server setup successful.'.green);
        process.exit(0);
    }
});

function initialSetup(callback) {
    var config = {
        mongodb: null,
        mailer: null
    };
    async.waterfall([
        function (cb) {
            console.log('You will now need to provide a little info to be able to start the server.');
            cb();
        },
        function (cb) {
            console.log('\nAPI SERVER\n'.cyan);
            prompt.get({
                properties: {
                    host: {
                        description: 'Enter the API Server\'s hostname',
                        type: 'string',
                        default: 'localhost',
                        required: true
                    },
                    port: {
                        description: 'Enter the API Server\'s port',
                        type: 'number',
                        pattern: /^[0-9]+$/,
                        message: 'Port must be a number',
                        default: 8080,
                        required: true
                    },
                    secure: {
                        description: 'Is the API server reachable over SSL?',
                        type: 'boolean',
                        default: false,
                        required: true
                    },
                    proxiedToDefault: {
                        description: 'Is the API server being proxied to port 80 or 443?',
                        type: 'boolean',
                        default: false,
                        required: true
                    }
                }
            }, function (err, data) {
                if (data) {
                    config.api_server = data;
                }
                cb(err);
            });
        },
        function (cb) {
            console.log('\nLEGACY REDIRECT SERVER\n'.cyan);
            prompt.get({
                properties: {
                    host: {
                        description: 'Enter the Redirect Server\'s hostname',
                        type: 'string',
                        default: 'localhost',
                        required: true
                    },
                    port: {
                        description: 'Enter the Redirect Server\'s port',
                        type: 'number',
                        pattern: /^[0-9]+$/,
                        message: 'Port must be a number',
                        default: 7070,
                        required: true
                    },
                    redirect_host: {
                        description: 'Enter the URL base of the redirect\'s target',
                        type: 'string',
                        default: 'http://localhost:8080',
                        required: true
                    }
                }
            }, function (err, data) {
                if (data) {
                    config.redirect_server = data;
                }
                cb(err);
            });
        },
        function (cb) {
            console.log('\nMONGODB\n'.cyan);
            prompt.get({
                properties: {
                    host: {
                        description: 'Enter the MongoDB hostname',
                        type: 'string',
                        default: 'localhost',
                        required: true
                    },
                    port: {
                        description: 'Enter the MongoDB port',
                        type: 'number',
                        pattern: /^[0-9]+$/,
                        message: 'Port must be a number',
                        default: 27017,
                        required: true
                    },
                    dbname: {
                        description: 'Database name',
                        type: 'string',
                        default: 'leerstandsmelder-api',
                        required: true
                    },
                    user: {
                        description: 'Database user (optional)',
                        type: 'string'
                    },
                    pass: {
                        description: 'Database password (optional)',
                        type: 'string',
                        hidden: true
                    }
                }
            }, function (err, data) {
                if (data) {
                    config.mongodb = data;
                }
                cb(err);
            });
        },
        function (cb) {
            console.log('\nFILE STORAGE\n'.cyan);
            prompt.get({
                properties: {
                    path: {
                        description: 'Enter the upload path',
                        type: 'string',
                        default: './assets',
                        required: true
                    }
                }
            }, function (err, data) {
                if (data) {
                    config.file_storage = {
                        path: data.path,
                        type: 'local'
                    };
                }
                cb(err);
            });
        },
        function (cb) {
            console.log('\nFILE DELIVERY\n'.cyan);
            prompt.get({
                properties: {
                    base_url: {
                        description: 'Enter the base url',
                        type: 'string',
                        default: 'http://localhost:8080',
                        required: true
                    }
                }
            }, function (err, data) {
                if (data) {
                    config.file_delivery = data;
                }
                cb(err);
            });
        },
        function (cb) {
            console.log('\nFRONTEND\n'.cyan);
            prompt.get({
                properties: {
                    base_url: {
                        description: 'Enter the base url',
                        type: 'string',
                        default: 'http://localhost:8080',
                        required: true
                    }
                }
            }, function (err, data) {
                if (data) {
                    config.frontend = data;
                }
                cb(err);
            });
        },
        function (cb) {
            console.log('\nEMAIL NOTIFICATIONS\n'.cyan);
            prompt.get({
                properties: {
                    address: {
                        description: 'Send notifications from this address',
                        type: 'string',
                        required: true
                    },
                    host: {
                        description: 'SMTP Host',
                        type: 'string',
                        required: true
                    },
                    port: {
                        description: 'SMTP Port',
                        type: 'number',
                        pattern: /^[0-9]+$/,
                        message: 'Port must be a number',
                        default: 465,
                        required: true
                    },
                    secure: {
                        description: 'Secure connection?',
                        type: 'boolean',
                        default: true,
                        required: true
                    },
                    validateSSL: {
                        description: 'Validate SSL certificate (turn off for self signed certs)?',
                        type: 'boolean',
                        default: true,
                        required: true
                    },
                    user: {
                        description: 'SMTP user (optional)',
                        type: 'string'
                    },
                    pass: {
                        description: 'SMTP password (optional)',
                        type: 'string',
                        hidden: true
                    }
                }
            }, function (err, data) {
                if (data) {
                    config.mailer = data;
                }
                cb(err);
            });
        },
        function (cb) {
            console.log('\nWriting config.json...\n');
            saveConfig(config, cb);
        }
    ], function (err) {
        callback(err);
    });
}

function createAdminUser(callback) {
    var mongoose = require('mongoose');
    async.waterfall([
        function (cb) {
            console.log('\nCREATE ADMIN USER\n'.cyan);
            prompt.get({
                properties: {
                    login: {
                        description: 'Login',
                        type: 'string',
                        default: 'Admin',
                        required: true
                    },
                    email: {
                        description: 'EMail',
                        type: 'string',
                        required: true
                    },
                    password: {
                        description: 'Password',
                        type: 'string',
                        required: true,
                        hidden: true
                    },
                    password_confirm: {
                        description: 'Repeat password',
                        type: 'string',
                        required: true,
                        hidden: true
                    }
                }
            }, cb);
        },
        function (data, cb) {
            loadConfig(function (err, config) {
                cb(err, data, config);
            });
        },
        function (data, config, cb) {
            mongoose.connect('mongodb://' + config.mongodb.host + ':' + config.mongodb.port + '/' + config.mongodb.dbname);
            mongoose.model('User', require('../models/user').User);
            var user = {
                login: data.login,
                email: data.email,
                password: data.password,
                confirmed: true
            };
            console.log(user);
            mongoose.model('User').create(user, cb);
        },
        function (user, cb) {
            console.log(user);
            mongoose.model('ApiKey', require('../models/api-key').ApiKey);
            mongoose.model('ApiKey').create({user_uuid: user.uuid, scopes: ['user', 'admin']}, cb);
        }
    ], function (err, apikey) {
        console.log(apikey);
        callback(err);
    });
}

function loadConfig(callback) {
    var fs = require('fs'),
        path = require('path');
    fs.readFile(path.join(__dirname, '..', 'config.json'), function (err, data) {
        callback(err && err.code !== 'ENOENT' ? err : null, data ? JSON.parse(data) : null);
    });
}

function saveConfig(config, callback) {
    var fs = require('fs'),
        path = require('path');
    fs.writeFile(path.join(__dirname, '..', 'config.json'), JSON.stringify(config, null, '\t'), function (err) {
        callback(err);
    });
}