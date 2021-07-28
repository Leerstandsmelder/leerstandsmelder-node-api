'use strict';

var swagger = require('swagger-node-restify'),
    RegionsController = require('../controllers/regions'),
    LocationsController = require('../controllers/locations'),
    CommentsController = require('../controllers/comments'),
    res = new RegionsController(),
    locations = new LocationsController(),
    comments = new CommentsController();

module.exports = {
    '/regions': {
        'post': {
            controller: res.map('post', {resource: 'Region'}),
            scope: 'admin',
            spec: {
                path: '/regions',
                description: 'Add a new Region',
                summary: 'Create Region',
                params: [
                    swagger.bodyParam('Region', 'A Region object', 'Region')
                ],
                errorResponses: [
                    swagger.errors.invalid('Region')
                ],
                nickname: 'createRegion',
                responseClass: 'Region'
            }
        },
        'get': {
            controller: res.map('find', {resource: 'Region'}),
            scope: 'public',
            spec: {
                path: '/regions',
                description: 'Get list of Regions',
                summary: 'Find Regions',
                nickname: 'findRegions',
                responseClass: 'List[Region]'
            }
        }
    },
    '/regions/:uuid': {
        'get': {
            controller: res.map('get', {resource: 'Region'}),
            scope: 'public',
            spec: {
                path: '/regions/{uuid}',
                description: 'Get a region',
                summary: 'Get Region',
                params: [swagger.pathParam('uuid', 'UUID of the region', 'string')],
                errorResponses: [swagger.errors.notFound('Region')],
                nickname: 'getRegion',
                responseClass: 'Region'
            }
        },
        'put': {
            controller: res.map('put', {resource: 'Region'}),
            scope: 'admin',
            spec: {
                path: '/regions/{uuid}',
                description: 'Update a region',
                summary: 'Update Region',
                params: [
                    swagger.pathParam('uuid', 'UUID of the region', 'string'),
                    swagger.bodyParam('Region', 'A Region object', 'Region')
                ],
                errorResponses: [swagger.errors.notFound('Region')],
                nickname: 'updateRegion',
                responseClass: 'Region'
            }
        },
        'delete': {
            controller: res.map('delete', {resource: 'Region'}),
            scope: 'admin',
            spec: {
                path: '/regions/{uuid}',
                description: 'Delete a region',
                summary: 'Delete Region',
                params: [swagger.pathParam('uuid', 'UUID of the region', 'string')],
                errorResponses: [swagger.errors.notFound('Region')],
                nickname: 'deleteRegion'
            }
        }
    },
    '/regions/:uuid/locations': {
        'get': {
            controller: locations.map('find', {
                resource: 'Location',
                select: 'uuid user_uuid region_uuid slug title lonlat postcode ' +
                    'street city buildingType description owner hidden active created updated'
            }),
            scope: 'public',
            spec: {
                path: '/regions/{uuid}/locations',
                description: 'Get list of Locations for a Region',
                summary: 'Find Region Locations',
                nickname: 'findRegionLocations',
                responseClass: 'List[Location]'
            }
        }
    },
    '/regions/:uuid/comments': {
        'get': {
            controller: comments.map('find', {
                resource: 'Comment',
                select: 'uuid user_uuid subject_uuid body hidden created updated'
            }),
            scope: 'public',
            spec: {
                path: '/regions/{uuid}/comments',
                description: 'Get list of Comments for a Region',
                summary: 'Find Region Comments',
                nickname: 'findRegionComments',
                responseClass: 'List[Comments]'
            }
        }
    },
    '/regions/:uuid/comments/all': {
        'get': {
            controller: comments.map('findAll', {
                resource: 'Comment',
                select: 'uuid user_uuid subject_uuid body hidden created updated'
            }),
            scope: 'public',
            spec: {
                path: '/regions/{uuid}/comments',
                description: 'Get list of Comments for a Region',
                summary: 'Find Region Comments',
                nickname: 'findRegionComments',
                responseClass: 'List[Comments]'
            }
        }
    }
};