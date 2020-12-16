var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compression = require('compression');
var helmet = require('helmet');
var index = require('./routes/index');
var config = require('./routes/config');
const settings = require('./config')
var apm = require('elastic-apm-node')
var app = express();
var http = require('http');
var router = express.Router();
var proxy = require('express-http-proxy');
//now we should configure the API to use bodyParser and look for JSON data in the body
app.use(logger('dev'));
app.use(helmet());
app.use(compression());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', index)
app.use('/healthcheck', index)
app.use('/config', config)

function getError(resp, proxyResData) {
  //look for errors in header first
  if (resp.headers.errors) {
    try {
      let data = JSON.parse(resp.headers.errors);
      let msg = '';
      let c = 0;
      if (Array.isArray(data)) {
        let data_len = data.length;
        for (var i = 0; i < data_len; i++) {
          let error = data[i];
          if (c > 0) {
            msg += ' - ';
          }
          if (error.errorMessage) {
            msg += error.errorMessage;
          }
          if (error.fieldName) {
            msg += ' - ' + error.fieldName;
            if (error.fieldValue) {
              msg += ': ' + error.fieldValue;
            }
          }
          c+=1;
        }
      } else {
        msg = data;
      }
      let err = new Error(msg);
      err.name = msg;
      return err
    } catch (e) {
      console.log('Unable to parse Error');
    }
  } else if (proxyResData) {
    try {
      let data = JSON.parse(proxyResData.toString('utf8'));
      let msg = data;
      if (data.exMessage) {
        msg = data.exMessage;
      } else if (data.className) {
        msg = data.className;
      } else if (data.message) {
        msg = data.message;
      }
      let err = new Error(msg);
      err.name = msg;
      return err;
    } catch (e) {
        console.log('Unable to parse Error');
    }
  }
  let err = Error('Unknown - '+ resp.statusCode);
  err.name = 'Unknown - '+ resp.statusCode;
  return err;
}


function getUserDetails(req) {
  headers = {}
  for (var header in req.headers) {
    headers[header.toLowerCase()] = req.headers[header];
  }
  let username = headers['x-forwarded-user'] ? headers['x-forwarded-user'] : 'N/A';
  let email = headers['x-forwarded-email'] ? headers['x-forwarded-email'] : 'N/A';
  return [ username, email ]
}

function captureErrorBody(proxyResData) {
  try {
    return JSON.parse(proxyResData.toString('utf8'))
  } catch (e) {
    return {}
  }
}

app.use('/api/find_state', proxy(settings.address_server, {
    preserveHostHdr: true,
    proxyReqPathResolver: function (req) {
      apm.setTransactionName('/api/find_state')
      let user = getUserDetails(req);
      apm.setUserContext({
        'username': user[0],
        'email': user[1]
      });
      return '/api/find_state'
    },
    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
      if (proxyRes.statusCode >= 400) {
          let err = getError(proxyRes, proxyResData);
          apm.captureError(err, {
            request: userReq,
            response: proxyRes,
            custom: captureErrorBody(proxyResData)
          });
      }
      return proxyResData
    }
}))

app.use('/api/find_city', proxy(settings.address_server, {
    preserveHostHdr: true,
    proxyReqPathResolver: function (req) {
      apm.setTransactionName('/api/find_city')
      let user = getUserDetails(req);
      apm.setUserContext({
        'username': user[0],
        'email': user[1]
      });
      return '/api/find_city'
    },
    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
      if (proxyRes.statusCode >= 400) {
          let err = getError(proxyRes, proxyResData);
          apm.captureError(err, {
            request: userReq,
            response: proxyRes,
            custom: captureErrorBody(proxyResData)
          });
      }
      return proxyResData
    }
}))

app.use('/api/find_address', proxy(settings.address_server, {
    preserveHostHdr: true,
    proxyReqPathResolver: function (req) {
      apm.setTransactionName('/api/find_address')
      let user = getUserDetails(req);
      apm.setUserContext({
        'username': user[0],
        'email': user[1]
      });
      return '/api/find_address'
    },
    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
      if (proxyRes.statusCode >= 400) {
          let err = getError(proxyRes, proxyResData);
          apm.captureError(err, {
            request: userReq,
            response: proxyRes,
            custom: captureErrorBody(proxyResData)
          });
      }
      return proxyResData
    }
}))

//sends /api/<endpoint> to <api_prefix>/<endpoint>
app.use('/api', proxy(settings.api_server, {
    preserveHostHdr: true,
    proxyReqPathResolver: function (req) {
      apm.setTransactionName('/api/'+req.url.split('/').filter(c => c != '').slice(0,1)[0])
      let user = getUserDetails(req);
      apm.setUserContext({
        'username': user[0],
        'email': user[1]
      });
      return settings.api_prefix+req.url
    },
    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
      if (proxyRes.statusCode >= 400) {
          let err = getError(proxyRes, proxyResData);
          apm.captureError(err, {
            request: userReq,
            response: proxyRes,
            custom: captureErrorBody(proxyResData)
          });
      }
      return proxyResData
    }
}))

app.get('*', function(req,res) {
    res.sendFile(path.join(__dirname+'/public/index.html'));
});
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  if (err.name === 'JsonSchemaValidation') {
    res.status(422);
    let responseData = {
       statusText: 'Bad Request',
       jsonSchemaValidation: true,
       validations: err.validations  // All of your validation information
    };
    res.json(responseData);
  } else {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    res.status(500).json({
          message: err.message,
          error: err
      });
  }
});

module.exports = app;
