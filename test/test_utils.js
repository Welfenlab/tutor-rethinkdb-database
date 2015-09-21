
var rdb = require("rethinkdb");
var cuid = require("cuid");
var rdbAPI = require("../lib/api");
var utils = require("../lib/utils");
var con = null;

var newDb = function(cb){
  // create a random unique name
  var dbName = "TutorTest_"+cuid();
  // should probably be configurable..
  var config = {host:"localhost", port:"28015",db:dbName};

  // to chain promises easierly
  var p = function(fn){ return function(){return fn();}};
  var cleanup = function(){
    return rdb.dbDrop(dbName).run(con);
  };
  var createDb = function(){
    return rdb.dbCreate(dbName).run(con)
  };
  var initDb = function(){
    con.use(dbName);
    return utils.init(con,config);
  };
  var startTest = function(){
    api = rdbAPI(con)

    api.con = con;
    api.dbName = dbName;
    cb(api, function(data){ return utils.load(con, data);},
      cleanup);
  };
  if(!con){
    return rdb.connect(config).then(function(conn){
      con = conn;
    }).then(p(createDb)).then(p(initDb)).then(p(startTest));
  } else {
    return createDb().then(p(initDb)).then(p(startTest));
  }
}

module.exports = {
  beforeTest: function(data){
    return function(done){
      this.timeout(25000);
      newDb(function(api, loadFunc, cleanupFunc){
        data.db = api;
        data.load = loadFunc;
        data.cleanup = cleanupFunc;
        done();
      });
    };
  },
  afterTest: function(data){
    return function(){
      this.timeout(12000);
      var cPromise = data.cleanup();
      data.cleanup = null;
      data.db = null;
      data.load = null;
      return cPromise;
    };
  },
  closeConnection: function(){
    if(con){
      conPromise = con.close();
      con = null;
      return conPromise
    }
  }
}
