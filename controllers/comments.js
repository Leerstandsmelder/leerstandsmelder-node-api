'use strict';

var mongoose = require('mongoose'),
    restifyErrors = require('restify-errors'),
    Promise = require('bluebird'),
    rHandler = require('../lib/util/response-handlers'),
    conditionalAdd = require('../lib/util/conditional-add'),
    CommonController = require('./common');

class CommentsController extends CommonController {
    constructor() {
        super();

        this.coroutines.findResource.main = Promise.coroutine(function* (req, res, next, config) {

            let query, q, maxdist = parseFloat(req.query.radius || 2000) / 6371,
                limit = Math.min(Math.max(parseInt(req.query.limit || 10000), 0), 10000),
                sort = req.query.sort || {"updated": -1},
                skip = Math.max(parseInt(req.query.skip || 0), 0),
                uuid = req.params.region_uuid || req.params.uuid,
                region = yield mongoose.model("Region").findOne({$or: [{uuid: uuid}, {slug: uuid}]}),
                flat = req.query.flat || false,
                isAdmin = req.api_key &&  req.api_key.scopes && (
                        req.api_key.scopes.indexOf("admin") > -1 ||
                        req.api_key.scopes.indexOf("region-" + region.uuid) > -1
                    );

            if ((!isAdmin && !region && !config.query.user_mapping) || (!isAdmin && region.hide)) {
                return rHandler.handleErrorResponse(new restifyErrors.NotFoundError(), res, next);
            }

            query = require('../lib/util/query-mapping')({}, req, config);
            query = conditionalAdd(query, "hidden", false, !isAdmin);
            query = conditionalAdd(query, "region_uuid", region ? region.uuid : undefined);
            query = conditionalAdd(query, "lonlat", {
                $near: [parseFloat(req.query.longitude || 10.0014), parseFloat(req.query.latitude || 53.5653)],
                $maxDistance: maxdist
            }, (req.query.longitude !== undefined && req.query.latitude !== undefined));

            q = mongoose.model("Location").find(query);
            q = q.sort(sort);
            q = q.select("uuid updated hidden title");
            q = q.skip(skip).limit(limit);

            var data = { page: Math.floor(skip / limit), pagesize: limit };
            data.results = yield q.exec();
            data.total = yield mongoose.model("Location").count(q._conditions);

            data.results = yield Promise.map(data.results, Promise.coroutine(function* (result) {
                result = result.toObject();
                result.comments = yield mongoose.model(config.resource).find({subject_uuid: result.uuid})
                    .select(config.select).exec();
                result.comments = result.comments ? result.comments : undefined;
                result.commentCount = result.comments.length;
                if(flat) {
                    result = result.comments;
                }
                return result;
            }));
            if(flat) {
                data.results = data.results.filter(function(item){ return item.length; });
                data.results = [].concat.apply([], data.results)
            } else {
                data.results = data.results.filter(function(item){ return item.commentCount > 0; });
            }

            rHandler.handleDataResponse(data, 200, res, next);
        });
    }
}

module.exports = CommentsController;
