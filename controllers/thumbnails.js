'use strict';

var path = require('path'),
    fs = require('fs'),
    sharp = require('sharp'),
    config = require('../config.json'),
    Promise = require('bluebird'),
    restifyErrors = require('restify-errors'),
    CommonController = require('./common');

class ThumbnailsController extends CommonController {
    constructor() {
        super();

        function loadAndShowImage(thumbFile, res) {
            let input = fs.createReadStream(thumbFile);
            res.setHeader('Content-Type', 'image/jpeg');
            return input.pipe(res);
        }

        this.coroutines.getResource.main = Promise.coroutine(function* (req, res, next) {
            let thumbFile = path.join(config.file_storage.path, 'thumbs',
                    `${req.params.uuid}-${req.params.type}-${req.params.size}.jpg`),
                originalFile = path.join(config.file_storage.path, 'photos',
                    `${req.params.uuid}`),
                fsExists = Promise.promisify((file, cb) => {
                    fs.stat(file, (err, stats) => {
                      if (err && err.code !== undefined && err.code === 'ENOENT') {
                        console.log('FILE NOT FOUND:', file);
                        return cb(null, null);
                      }
                      if(err === null) {
                          return cb(null, stats);
                      }
                      cb(err);
                    });
                });

            var stats = yield fsExists(originalFile);
            if (!stats) {
                return next(new restifyErrors.NotFoundError());
            }

            var input, tstats = yield fsExists(thumbFile);

            if (!tstats) {
                var size = req.params.size.split('x'),
                    width = Math.min(1000, Math.max(0, parseInt(size[0]))),
                    height = size.length === 2 ? Math.min(1000, Math.max(0, parseInt(size[1]))) : width,
                    imgpipe = sharp();

                if (req.params.type === 'square') {
                    imgpipe.resize(width, width || null, {
                        kernel: sharp.kernel.lanczos2
                    }).crop(sharp.strategy.entropy);
                } else {
                    imgpipe.resize(width || null, height || null, {
                        kernel: sharp.kernel.lanczos2
                    });
                }

                imgpipe.clone().jpeg({quality: 80}).toFile(thumbFile, (err) => {
                    if (err) {
                        console.log('Error generating thumbnail: ' + thumbFile,  err);
                        return err;
                    }
                    return loadAndShowImage(thumbFile, res);
                });

                input = fs.createReadStream(originalFile);
                input.pipe(imgpipe);
            } else {
                return loadAndShowImage(thumbFile, res);
            }
        });
    }
}

module.exports = ThumbnailsController;
