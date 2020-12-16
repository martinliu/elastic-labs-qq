var express = require('express');
const config = require('../config')
var router = express.Router();
router.get('/', function(req, res, next) {
  // lowercase headers
  headers = {}
  for (var header in req.headers) {
    headers[header.toLowerCase()] = req.headers[header];
  }
  config['user'] = {
    'username': headers['x-forwarded-user'] ? headers['x-forwarded-user'] : 'N/A',
    'email': headers['x-forwarded-email'] ? headers['x-forwarded-email'] : 'N/A',
    'ip': headers['x-forwarded-ip'] ? headers['x-forwarded-ip'] : (headers['x-forwarded-for'] ? headers['x-forwarded-for'] : null)
  }
  res.json(config);
});

module.exports = router;
