'use strict';
var mongoose = require('mongoose'),
    Promise = require('bluebird'),
    validator = require('validator'),
    modelHelper = require('../lib/util/model-helper'),
    Schema = mongoose.Schema,
    uniqueValidator = require('mongoose-unique-validator'),
    User = new Schema({

        uuid: { type: String, unique: true },
        nickname: { type: String, required: true },
        email: {type: String, index: true, unique: true, required: true },
        crypted_password: { type: String, required: true },
        password_salt: { type: String, required: true },
        confirmed: { type: Boolean, default: false },
        blocked: { type: Boolean, default: false },
        message_me: { type: Boolean, default: false },
        notify: { type: Boolean, default: false },
        share_email: { type: Boolean, default: false },
        accept_terms: { type: Boolean, default: false },
        created: Date,
        updated: Date,
        last_login: Date,
        failed_logins: { type: Number, default: 0 },
        single_access_token: String,
        scopes: { type: [String], default: ['user'] },
        legacy_id: String

    }, {
        autoindex: process.env.NODE_ENV !== 'production',
        id: false
    }),
    SwaggerSpec = {
        required: [
            'nickname',
            'email'
        ],
        properties: {
            uuid: {
                type: 'string'
            },
            nickname: {
                type: 'string'
            },
            email: {
                type: 'string'
            },
            created: {
                type: 'date'
            },
            updated: {
                type: 'date'
            },
            message_me: {
                type: 'boolean',
                defaultValue: false
            },
            notify: {
                type: 'boolean',
                defaultValue: false
            },
            share_email: {
                type: 'boolean',
                defaultValue: false
            },
            accept_terms: {
                type: 'boolean',
                defaultValue: false
            },
        }
    };

User.plugin(uniqueValidator, { message: 'errors.users.email_exists' });

User.path('email').validate(function (value) {
    return validator.isEmail(value);
}, 'errors.users.invalid_email');

User.path('crypted_password').validate(function (value) {
    return validator.isLength(value, 8);
}, 'errors.users.password_too_short');

User.virtual('password').set(function (password) {
    this.password_salt = this.constructor.generatePasswordSalt();
    this.crypted_password = password;
});

/*
//TODO: validate accept_terms on the server on user creation
User.path('accept_terms').validate(function (value) {
    return value;
}, 'errors.users.accept_terms');
*/

User.methods.isValidPassword = function (password) {
    var instance = this;
    if (this.failed_logins > 3 && Date.now() - this.last_login < 300000) {
        throw new Error('errors.users.too_many_failed_logins');
    } else {
        return this.constructor.encryptPassword(password, this.password_salt)
            .then(Promise.coroutine(function* (password_hash) {
                instance.last_login = Date.now();
                var loginSuccess = instance.crypted_password === password_hash;
                if (!loginSuccess) {
                    instance.failed_logins += 1;
                } else {
                    instance.failed_logins = 0;
                }
                yield instance.save();
                return loginSuccess;
            }));
    }
};

User.statics.generatePasswordSalt = function () {
    var secureRandom = require('secure-random');
    var saltbytes = secureRandom.randomBuffer(48);
    return saltbytes.toString('hex');
};

User.statics.encryptPassword = function (password, salt) {
    return Promise.promisify(require('crypto').pbkdf2)(password, salt, 80000, 256, 'SHA1')
        .then(function (hash_bytes) {
            return hash_bytes ? hash_bytes.toString('hex') : null;
        });
};

User.methods.confirmUser = function () {
    this.single_access_token = null;
    this.confirmed = true;
    return this.save();
};

User.methods.generateSingleAccessToken = function () {
    var sha1 = require('sha1');
    this.single_access_token = sha1(this.email + Math.round(Math.random() * 1000000).toString());
};

User.methods.sendConfirmationMail = function () {
    var mailer = require('../lib/mailer/mailer');
    return mailer.sendConfirmationRequest(this);
};

User.methods.resendConfirmationMail = function () {
    var mailer = require('../lib/mailer/mailer');
    return mailer.resendConfirmationRequest(this);
};

User.methods.requestPasswordReset = function () {
    var mailer = require('../lib/mailer/mailer'),
        _self = this;
    _self.generateSingleAccessToken();
    return _self.save()
        .then(function () {
            return mailer.sendResetPassword(_self);
        });
};

module.exports.User = modelHelper.setup(
    User,
    function (next) {
        var now = Date.now(),
            sanitizer = require('sanitizer');
        this.updated = now;
        this.nickname = sanitizer.sanitize(this.nickname);
        if (!this.uuid) {
            this.generateUUID();
        }
        if (!this.created) {
            this.created = now;
        }
        if (typeof this.password_salt === 'undefined') {
            this.password_salt = this.constructor.generatePasswordSalt();
        }
        if (typeof this.single_access_token === 'undefined' && !this.confirmed) {
            this.generateSingleAccessToken();
        }
        // TODO: clean up the password encryption process
        if (this.modifiedPaths().indexOf('crypted_password') > -1) {
            var instance = this;
            return this.constructor.encryptPassword(this.crypted_password, this.password_salt)
                .then(function (crypted_password) {
                    instance.crypted_password = crypted_password;
                    next();
                });
        } else {
            next();
        }
    },
    null,
    function (obj) {
        delete obj.crypted_password;
        delete obj.password_salt;
        delete obj.crypted_password;
        delete obj.confirmed;
        delete obj.blocked;
        delete obj.failed_logins;
        delete obj.single_access_token;
        delete obj.legacy_id;
        delete obj.scopes;
    }
);
module.exports.SwaggerSpec = SwaggerSpec;