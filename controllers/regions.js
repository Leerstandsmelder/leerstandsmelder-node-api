'use strict';

var mongoose = require('mongoose'),
    Promise = require('bluebird'),
    restifyErrors = require('restify-errors'),
    rHandler = require('../lib/util/response-handlers'),
    CommonController = require('./common');

class RegionsController extends CommonController {
    constructor() {
        super();

        this.coroutines.findResource.main = Promise.coroutine(function* (req, res, next, config) {
            let limit = parseInt(req.query.limit || 0),
                skip = parseInt(req.query.skip || 0),
                lat = req.params.lat || req.query.lat,
                lon = req.params.lon || req.query.lon,
                isAdmin = req.api_key &&  req.api_key.scopes && (
                        req.api_key.scopes.indexOf("admin") > -1 ||
                        req.api_key.scopes.indexOf("region-" + req.params.uuid) > -1
                    );

            if (lat && lon) {
                let q = mongoose.model("Region").where("lonlat");
                q.near({
                    center: {coordinates: [lon, lat], type: 'Point'}
                });
                q = config.select ? q.select(config.select) : q;
                if (req.query.sort) {
                    q = q.sort(req.query.sort);
                }
                if (req.query.limit) {
                    q = q.limit(limit);
                }
                if (req.query.skip) {
                    q = q.skip(skip);
                }
                let data = {page: Math.floor(skip / limit), pagesize: limit};

                data.results = yield q.exec();
                data.total = yield mongoose.model(config.resource).count(q._conditions);

                rHandler.handleDataResponse(data, 200, res, next);
            } else {
                var results = yield mongoose.model("Location").mapReduce({
                    map: function () {
                        if (!this.hidden) {
                            emit(this.region_uuid, 1); // jshint ignore:line
                        }
                    },
                    reduce: function (k, v) {
                        return Array.sum(v);
                    }
                });

                var output = [];

                yield Promise.map(results, function (item) {
                    var hideParamter = isAdmin ? {uuid: item._id} : {uuid: item._id, hide:false};
                    return mongoose.model("Region").findOne(hideParamter)
                        .then(function (region) {
                            if (region) {
                                var out = region.toObject();
                                out.locations = item.value;
                                output.push(out);
                            }
                        });
                }, {concurrency: 1});

                if (req.query.sort) {
                    // function lifted from http://stackoverflow.com/a/4760279/578963
                    // FIXME: and apparently is not working too well...?
                    output.sort(function sortOn(property) {
                        var sortOrder = 1;
                        if (req.query.sort[0] === "-") {
                            sortOrder = -1;
                            req.query.sort = req.query.sort.substr(1);
                        }
                        return function (a, b) {
                            var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
                            return result * sortOrder;
                        };
                    });
                }

                let total = output.length,
                    data = {page: Math.floor(skip / limit), pagesize: limit};
                data.total = total;
                data.results = output.slice(skip, limit || total);

                rHandler.handleDataResponse(data, 200, res, next);
            }
        });
        this.coroutines.getResource.main = Promise.coroutine(function* (req, res, next, config) {
            let isAdmin = req.api_key &&  req.api_key.scopes && (
                    req.api_key.scopes.indexOf("admin") > -1 ||
                    req.api_key.scopes.indexOf("region-" + req.params.uuid) > -1
                );
                let query = {$or: [{uuid: req.params.uuid}, {slug: req.params.uuid.toLowerCase()}]};
                if(!isAdmin) {
                    query = {$and: [{hide: false}, {$or: [{uuid: req.params.uuid}, {slug: req.params.uuid.toLowerCase()}]}]};
                }
                let q = mongoose.model(config.resource).findOne(query);
                q = config.select ? q.select(config.select) : q;
                let result = yield q.exec();
                if (!result) {
                    return rHandler.handleErrorResponse(new restifyErrors.NotFoundError(), res, next);
                }
                result = result.toObject();

                rHandler.handleDataResponse(result, 200, res, next);
            });
    }
}

module.exports = RegionsController;
