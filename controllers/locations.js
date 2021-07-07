'use strict';

var mongoose = require('mongoose'),
    restifyErrors = require('restify-errors'),
    Promise = require('bluebird'),
    rHandler = require('../lib/util/response-handlers'),
    conditionalAdd = require('../lib/util/conditional-add'),
    CommonController = require('./common');

class LocationsController extends CommonController {
    constructor() {
        super();

        this.coroutines.findResource.main = Promise.coroutine(function* (req, res, next, config) {
            let query, q, maxdist = parseFloat(req.query.radius || 2000) / 6371,
                limit = Math.min(Math.max(parseInt(req.query.limit || 10000), 0), 10000),
                sort = req.query.sort || {"updated": -1},
                skip = Math.max(parseInt(req.query.skip || 0), 0),
                uuid = req.params.region_uuid || req.params.uuid,
                isAdmin = req.api_key &&  req.api_key.scopes && (
                    req.api_key.scopes.indexOf("admin") > -1 ||
                    req.api_key.scopes.indexOf("region-" + uuid) > -1
                );

            var region = false;
            if(uuid) {
              let regionQuery = {$or: [{uuid: uuid}, {slug: uuid.toLowerCase()}]};
              if(!isAdmin) {
                  regionQuery = {$and: [{hide: false}, {$or: [{uuid: uuid}, {slug: uuid.toLowerCase()}]}]};
              }
              region = yield mongoose.model("Region").findOne(regionQuery);

              if (!region && (!config.query || !config.query.user_mapping)) {
                  return rHandler.handleErrorResponse(new restifyErrors.NotFoundError(), res, next);
              }
            }
            query = require('../lib/util/query-mapping')({}, req, config);
            if(!isAdmin && (!config.query || !config.query.user_mapping)) {
                query = conditionalAdd(query, "hidden", false,!isAdmin);
            }

            query = conditionalAdd(query, "region_uuid", region ? region.uuid : undefined);
            query = conditionalAdd(query, "lonlat", {
                $near: [parseFloat(req.query.longitude || 10.0014), parseFloat(req.query.latitude || 53.5653)],
                $maxDistance: maxdist
            }, (req.query.longitude !== undefined && req.query.latitude !== undefined));

            q = mongoose.model(config.resource).find(query);
            q = q.sort(sort);
            q = config.select ? q.select(config.select) : q;
            q = q.skip(skip).limit(limit);

            var data = { page: Math.floor(skip / limit), pagesize: limit };
            data.results = yield q.exec();
            data.total = yield mongoose.model(config.resource).count(q._conditions);

            data.results = yield Promise.map(data.results, Promise.coroutine(function* (result) {
                result = result.toObject();
                result.user = yield mongoose.model("User").findOne({uuid: result.user_uuid})
                    .select("uuid nickname").exec();
                result.user = result.user ? result.user.toObject() : undefined;
                if(region) {
                  result.region = region;
                } else {
                  result.region = yield mongoose.model("Region").findOne({uuid: result.region_uuid})
                      .select("uuid title slug hide").exec();
                }
                if(result.region && result.region.hide && !isAdmin) {
                    //hide complete location because region is hidden
                    return rHandler.handleErrorResponse(new restifyErrors.NotFoundError(), res, next);
                }
                result.region = result.region ? result.region.toObject() : undefined;
                let photo = yield mongoose.model("Photo").findOne({location_uuid: result.uuid}).exec();
                result = conditionalAdd(result, "photo", photo ? photo.toObject() : undefined);
                return result;
            }));

            rHandler.handleDataResponse(data, 200, res, next);
        });
        this.coroutines.getResource.main = Promise.coroutine(function* (req, res, next, config) {
                let query = {$or: [{uuid: req.params.uuid}, {slug: req.params.uuid.toLowerCase()}]},
                    q = mongoose.model(config.resource).findOne(query);
                q = config.select ? q.select(config.select) : q;
                let result = yield q.exec();
                if (!result) {
                    return rHandler.handleErrorResponse(new restifyErrors.NotFoundError(), res, next);
                }
                result = result.toObject();

                //check visibility
                let region = yield mongoose.model("Region").findOne({uuid:result.region_uuid});
                if (!region) {
                    return rHandler.handleErrorResponse(new restifyErrors.NotFoundError(), res, next);
                }
                // TODO: put this in lib
                let isAdmin = req.api_key &&  req.api_key.scopes && (
                        req.api_key.scopes.indexOf("admin") > -1 ||
                        req.api_key.scopes.indexOf("region-" + region.uuid) > -1 ||
                        result.user_uuid == req.user.uuid
                    );

                if (!isAdmin && (result.hidden || region.hide)) {
                    return rHandler.handleErrorResponse(new restifyErrors.NotFoundError(), res, next);
                }

                if (result && result.user_uuid) {
                    result.user = yield mongoose.model("User")
                        .findOne({uuid:result.user_uuid})
                        .select("uuid nickname").exec();
                    result.user = result.user ? result.user.toObject() : undefined;
                }

                rHandler.handleDataResponse(result, 200, res, next);
            });

        this.coroutines.searchResource = {
            pre: Promise.resolve,
            main: Promise.coroutine(function* (req, res, next, config) {
                var parts = req.query.q.split(' '),
                    query = {
                        $and: parts.map(function (part) {
                            var reg = new RegExp(part, 'i');
                            return {
                                $and: [
                                    { hidden: false },
                                    {
                                        $or: [
                                            {title: {$regex: reg}},
                                            {description: {$regex: reg}},
                                            {owner: {$regex: reg}},
                                            {street: {$regex: reg}},
                                            {city: {$regex: reg}},
                                            {postcode: {$regex: reg}},
                                            {street: {$regex: reg}}
                                        ]
                                    }
                                ]
                            };
                        })
                    };
                if (req.params.uuid) {
                    query.region_uuid = req.params.uuid;
                }
                var q = mongoose.model("Location").find(query);
                q = config.select ? q.select(config.select) : q;
                let result = yield q.exec(),
                    regions = {};
                if (Array.isArray(result)) {
                    for (let i = 0; i < result.length; i+=1) {
                        let item = result[i].toObject();
                        if (!regions.hasOwnProperty(item.region_uuid)) {
                            let region = yield mongoose.model("Region").findOne({uuid: item.region_uuid});
                            if (region) {
                                regions[item.region_uuid] = region.slug;
                            }
                        }
                        item.region_slug = regions[item.region_uuid];
                        result[i] = item;
                    }
                }
                rHandler.handleDataResponse(result, 200, res, next);
            })
        };
    }
}

module.exports = LocationsController;
