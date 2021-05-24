'use strict';

var Promise = require('bluebird'),
    mongoose = require('mongoose'),
    path = require('path'),
    fs = require('fs-extra'),
    config = require('../config.json'),
    workers = require('../lib/workers'),
    aclManager = require('../lib/auth/acl-manager'),
    responseHandlers = require('../lib/util/response-handlers');

module.exports.get = function (req, res, next) {
    mongoose.model('Photo').findOne({uuid: req.params.uuid})
        .exec(function (err, photo) {
            if (err) {
                res.send(responseHandlers.handleErrorResponse(err, res, next));
            } else {
                var restifyErrors = require('restify-errors');
                if (photo) {
                    var readStream = fs.createReadStream(path.join(config.file_storage.path, 'photos', photo.uuid));
                    readStream.on('error', function (err) {
                        console.log(`Error reading image file: ${err.message}`);
                        res.send(new restifyErrors.NotFoundError());
                    });
                    res.setHeader("Content-Type", photo.mime_type);
                    readStream.pipe(res);
                } else {
                    res.send(new restifyErrors.NotFoundError());
                }
            }
            next();
        });
};

module.exports.post = function (req, res, next) {
    // TODO: need to be able to set position
    var checksum = require('checksum'),
        file = req.files.file,
        payload = {
            location_uuid: req.params.location_uuid,
            user_uuid: req.user.uuid,
            creator_uuid: req.user.uuid,
            publisher_uuid: req.user.uuid,
            rights_holder_uuid: req.user.uuid,
            filename: file.name,
            extension: path.extname(file.name).replace('.', ''),
            mime_type: file.type,
            filehash: file.hash,
            size: file.size
        };
    return Promise.promisify(checksum.file)(file.path)
        .then((filehash) => {
            payload.filehash = filehash;
            return mongoose.model('Photo').create(payload);
        })
        .then((photo) => {
            var dest = path.join(config.file_storage.path, 'photos', photo.uuid),
                readStream = fs.createReadStream(file.path),
                writeStream = fs.createWriteStream(dest),
                errorHandler = (err) => {
                    throw new Error('Failed to upload photo: ' + err.message);
                };
            readStream.on('error', errorHandler);
            readStream.pipe(writeStream);
            return new Promise(function (resolve, reject) {
                writeStream.on('error', function (err) {
                    reject(err);
                });
                writeStream.on('finish', function () {
                    resolve(photo);
                });
            });
        })
        .then((photo) => {
            return aclManager.setAclEntry(
                req.path + '/' + photo.uuid,
                [req.user.uuid, 'admin'],
                ['get', 'put', 'delete']
            ).then(() => {
                return aclManager.setAclEntry(req.path + '/' + photo.uuid, ['user'], ['get']);
            }).then(() => {
                return photo;
            });
        })
        .then((photo) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(200, photo);
            next();
        })
        .catch((err) => {
            res.send(responseHandlers.handleErrorResponse(err, res, next));
            next();
        });
};
