var express = require('express');
var router = express.Router();

/* Root endpoint */
router.get('/', function(req, res, next) {
  res.json({"service":"react-petclinic-server"});
});

module.exports = router;
