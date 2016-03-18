'use strict';

var mongoose = require('mongoose'),
    Promise = require('bluebird'),
    rHandler = require('../lib/util/response-handlers'),
    CommonController = require('./common');

class LocationsController extends CommonController {
    constructor() {
        super();

        this.coroutines.findResource.main = Promise.coroutine(function* (req, res, next, config) {
            var maxdist = parseFloat(req.query.radius || 2000) / 6371,
                page = parseInt(req.query.page || 0),
                pagesize = parseInt(req.query.pagesize || 100),
                geoquery = {
                    lonlat: {
                        $near: [parseFloat(req.query.longitude || 10.0014), parseFloat(req.query.latitude || 53.5653)],
                        $maxDistance: maxdist
                    }
                },
                query = require('../lib/util/query-mapping')(geoquery, req, config),
                q = mongoose.model(config.resource).find(query);

            q = config.select ? q.select(config.select) : q;
            q = q.skip(page * pagesize).limit(pagesize);

            var data = yield q.exec(),
                result = {
                    page: page,
                    pagesize: pagesize,
                    total: yield mongoose.model(config.resource).count(q._conditions),
                    results: data
                };
            rHandler.handleDataResponse(result, 200, res, next);
        });
    }
}

module.exports = LocationsController;