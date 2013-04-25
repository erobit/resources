var resource  = require('resource'),
    admin = resource.define('admin');

admin.schema.description = "a web based admin panel";

resource.use('system');
resource.use('view');
resource.use('datasource', { datasource: "fs" });

resource.use('hook');
resource.use('forms');
resource.use('http');

admin.method('listen', listen, {
  "description": "start a listening admin web server",
  "properties": {
    "options": {
      "type": "object",
      "properties": {
        "port": resource.http.schema.properties['port'],
        "host": resource.http.schema.properties['host']
      }
    },
    "callback": {
      "type": "function"
    }
  }
});

admin.method('start', listen, admin.listen.schema);

function listen (options, callback) {
  var connect = require('connect');
  var auth = connect.basicAuth('admin', 'admin');

  if(!resource.http.app) {
    resource.http.listen(options, next);
  }
  else {
    next();
  }

  function next(err) {
    if (err) {
      callback(err);
      return;
    }

    //
    // Create view middleware using /admin/view
    //
    resource.http.app.use(resource.view.middle({ viewPath: __dirname + '/view', prefix: '/admin'}));

    //
    // Serve the /public/ admin folder
    //
    resource.http.app.use(connect.static(__dirname + '/public'));

    resource.view.create({ path: __dirname + '/view'}, function (err, view) {
      if (err) {
        callback(err);
        return;
      }

      //
      // TODO: cleanup route handlers / make into common methods
      //

      resource.http.app.get('/admin', auth, function (req, res, next) {
        var _r = _resources();
        view.index.render({
          system: JSON.stringify(dashboard(), true, 2)
        });
        str = view.index.present({ resources: resource.resources });
        res.end(str);
      });

      /*
        //
        // Remark: Commented out docs route ( for now )
        //
      resource.http.app.get('/admin/docs/resources/:resource', function (req, res, next) {
        var r = resource.resources[req.param('resource')];
        var str = resource.docs.generate(r);
        var view = resource.view.create({
          template: str,
          input: "markdown"
        });
        str = '<link href="/style.css" rel="stylesheet"/> \n' + view.render();
        res.end(str);
      });
      */

      //
      // TODO: The following routes should be able to be handled by the view engine....
      //

      resource.http.app.get('/admin/datasources/:datasource', auth, function (req, res, next) {
       resource.datasource.get(req.param('datasource'), function(err, result){
         view.datasource.render({});
         str = view.datasource.present({ datasource: result });
         res.end(str);
       });
      });

      resource.http.app.get('/admin/resources/:resource', auth, function (req, res, next) {
        view.resource.render({});
        view.resource.present({
          resource: req.param('resource')
        }, function(err, str){
          res.end(str);
        });
      });

      resource.http.app.get('/admin/resources/:_resource/:_method', auth, function (req, res, next) {
        view.method.render();
        view.method.present({ resource: req.param('_resource'), method: req.param('_method') }, function(err, str){
          res.end(str);
        });
      });

      resource.http.app.post('/admin/resources/:_resource/:_method', auth, function (req, res, next) {

        var _resource = resource.resources[req.param('_resource')],
            _method = _resource[req.param('_method')],
            id = req.param('id'),
            str,
            data = req.big.params,
            props = _method.schema.properties || {};

        delete data._resource;
        delete data._method;

        if(typeof _method.schema === 'undefined') {
          _method.schema = {
            properties: {}
          };
        }

        //
        // If an options hash is expected in the resource method
        //
        if(_method.schema.properties && typeof _method.schema.properties.options !== 'undefined') {
          props = _method.schema.properties.options.properties;
        }

        //
        // If a value is supposed to be a number, attempt to coerce it
        //
        // TODO: How should this behave for "any" cases? Keep in mind that
        // ip addresses will successfully parse as floats.
        //
        Object.keys(data).forEach(function (p) {
          if (props && props[p] && props[p].type === 'number') {
            var coerced = parseFloat(data[p], 10);

            if (coerced.toString() !== 'NaN') {
              data[p] = coerced;
            }
          }
        });

        view.method.render();

        view.method.present({
          resource: req.param('_resource'),
          method: req.param('_method'),
          data: data,
          action: 'post',
          id: id
        }, function(err, str){
          res.end(str);
        });

      });

      resource.http.app.get('/admin/resources/:_resource/:_method/:id', auth, function (req, res, next) {
        var _id = req.param('id');
        view.method.render();
        view.method.present({
          resource: req.param('_resource'),
          method: req.param('_method'),
          id: _id
        }, function(err, str){
          res.end(str);
        });
      });

      resource.http.app.post('/admin/resources/:_resource/:_method/:id', auth, function (req, res, next) {

        var _method = resource.resources[req.param('_resource')].methods[req.param('_method')];

        //
        // Pull out all the params from the request based on schema
        //
        if(typeof _method.schema === 'undefined') {
          _method.schema = {
            properties: {}
          };
        }

        var props, str, data = req.big.params;

        props = _method.schema.properties || {};

        if(typeof _method.schema.properties !== 'undefined' && typeof _method.schema.properties.options !== 'undefined') {
          props = _method.schema.properties.options.properties;
        }

        Object.keys(props).forEach(function(prop) {
          data[prop] = req.param(prop);
          if(props[prop].type === "number") {
            data[prop] = Number(req.param(prop));
            if(data[prop].toString() === "NaN") {
              data[prop] = req.param(prop);
            }
          }
        });

        view.method.render();

        view.method.present({
          resource: req.param('_resource'),
          method: req.param('_method'),
          id: req.param('id'),
          data: data,
          request: req,
          response: res,
          action: 'post'
        }, function(err, str){
          res.end(str);
        });

      });

      callback(null, resource.http.server);
    });
  }
}

//
// TODO: move this out of here to resource.toJSON
//
  function _resources () {
    var arr = [];
    Object.keys(resource.resources).forEach(function(r){
      arr.push(r);
    });
    return arr;
  }
  function _methods (resource) {
    var arr = [];
    Object.keys(resource.methods).forEach(function(m){
      arr.push(m);
    });
    return arr;
  }
//
//
//


// generates JSON-data to be sent to dashboard view
function dashboard () {

  var os  = require('os'),
      obj = {};

  obj.version  = "v0.0.0";

  obj.system = resource.system.info();

  obj.resources = [];

  for(var r in resource.resources) {
    obj.resources.push(r);
  }

  return obj;

};

exports.admin = admin;

exports.dependencies = {
  "connect": "2.7.1",
  "highlight": "0.2.3"
};
