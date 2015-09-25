
var rdb = require("rethinkdb");
var cuid = require("cuid");
var rdbAPI = require("../lib/api");
var utils = require("../lib/utils");

var conData = {con:null, dbName: null};

var newDb = function(cb){
  var con = conData.con;
  // create a random unique name
  var dbName = conData.dbName || "TutorTest_"+cuid();
  conData.dbName = dbName;
  // should probably be configurable..
  var config = {host:"localhost", port:"28015",db:dbName};

  // to chain promises easierly
  var p = function(fn){ return function(){return fn();}};
  var cleanup = function(){
    return utils.empty(con, config);
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
    console.log("Initializing RethinkDB... [~ 1 minute]");
    return rdb.connect(config).then(function(conn){
      con = conn;
      conData.con = con;
    }).then(p(createDb)).then(p(initDb)).then(p(startTest));
  } else {
    return startTest();
  }
}

module.exports = {
  beforeTest: function(data){
    return function(done){
      this.timeout(60000);
      if(!data.db){
        newDb(function(api, loadFunc, cleanupFunc){
          data.db = api;
          data.load = loadFunc;
          data.cleanup = cleanupFunc;
          done();
        });
      } else {
        done();
      }
    };
  },
  afterTest: function(data){
    return function(){
      this.timeout(12000);
      var cPromise = data.cleanup();
      return cPromise;
    };
  },
  closeConnection: function(){
    if(conData.con){
      return rdb.dbDrop(conData.dbName).run(conData.con).then(function(){
        conData.con.close();
        conData.con = null;
      });
    }
  }
}
