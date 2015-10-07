
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.should();

var rdb = require("rethinkdb");

var moment = require("moment");
var testUtils = require("./test_utils");

after(function(){
  return testUtils.closeConnection();
});

describe("User queries", function(){
  var test = {db:null,cleanup:null,load:null};
  // setup a new fresh database for every test!
  beforeEach(testUtils.beforeTest(test));
  // remove the DB after each test
  afterEach(testUtils.afterTest(test));

  it("should be possible to query a user", function(){
    return test.load(
    {
      Users:[{id:1}]
    }).then(function(){
      return test.db.Users.exists(1).then(function(exists){
        exists.should.be.true;
      });
    });
  });
  it("should be possible to query a non existing user", function(){
    return test.load(
    {
      Users:[{id:1}]
    }).then(function(){
      return test.db.Users.exists(2).then(function(exists){
        exists.should.be.false;
      });
    });
  });
  it("should be possible to query a users pseudonym", function(){
    return test.load({Users:[{id:1,pseudonym:"P"}]})
    .then(function(){
      return test.db.Users.getPseudonym(1).then(function(pseudonym){
        pseudonym.should.equal("P");
      });
    });
  });
  it("should be possible to change a users pseudonym", function(){
    return test.load({Users:[{id:1,pseudonym:"P"}]})
    .then(function(){
      return test.db.Users.setPseudonym(1,"Q");
    }).then(function(){
      return test.db.Users.getPseudonym(1).then(function(p){
        p.should.equal("Q");
      });
    });
  });
  it("should be possible to create a new user", function(){
    return test.db.Users.create({id:1,matrikel:"12345678",pseudonym:"P",name:"A"}).then(function(){
      return test.db.Users.get(1).then(function(u){
        u.pseudonym.indexOf("P").should.equal(0);
        u.id.should.equal(1);
        u.matrikel.should.equal("12345678");
      });
    });
  });
  it("creating a new user should put the user into a group", function(){
    return test.db.Users.create({id:1,matrikel:"12345678",pseudonym:"P",name:"A"}).then(function(){
      return test.db.Groups.getGroupForUser(1).should.be.fulfilled;
    });
  });
  it("creating a new user should create the pseudonym", function(){
    return test.db.Users.create({id:1,matrikel:"12345678",pseudonym:"P",name:"A"}).then(function(){
      return test.db.Users.getInternalPseudonymList().then(function(list){
        list.should.have.length(1);
      });
    });
  });
  it("creating a user with the same id updates the user", function(){
    return test.load({Users:[{id:1,pseudonym:"P"}]})
    .then(function(){
      return test.db.Users.create({id:1,matrikel:"12345678",pseudonym:"Q",name:"A"}).then(function(){
        return test.db.Users.get(1).then(function(u){
          u.pseudonym.indexOf("Q").should.equal(0);
          u.id.should.equal(1);
          u.matrikel.should.equal("12345678");
          u.name.should.equal("A");
        });
      });
    });
  });

  it("can query a tutor", function(){
    return test.load({Tutors: [{name: "a",pw:"hidden!", salt:"ABC"}]})
    .then(function(){
      return test.db.Users.getTutor("a").then(function(tutor){
        (tutor == null).should.be.false;
        tutor.name.should.equal("a");
        tutor.salt.should.equal("ABC");
        tutor.should.not.have.key("pw");
      });
    });
  });

  it("clears pending pseudonyms if they are old enough", function() {
    return test.load({PseudonymList:[{pseudonym:"abc",user:2,locked:rdb.ISO8601(moment().subtract(11,"minutes").toJSON())},
                                     {pseudonym:"abc",user:1,locked:rdb.ISO8601(moment().subtract(16,"minutes").toJSON())}]})
    .then(function() {
      return test.db.Users.clearPendingPseudonyms().then(function() {
        return test.db.Users.getInternalPseudonymList().then(function(list) {
          list.should.have.length(1)
        });
      });
    });
  });

  it("cannot query a non existing user", function(){
    return test.db.Users.getTutor("nonExisting").should.be.rejected;
  });

  it("can authorize a tutor", function(){
    var cmpPromise = function(pw){ return new Promise(function(resolve){
        resolve(pw == "test123");
      })
    };
    return test.load({Tutors: [{name: "a", pw:"test123"}]})
    .then(function(){
      return test.db.Users.authTutor("a", cmpPromise).then(function(isAuthorized){
        isAuthorized.should.be.true;
      });
    });
  });

  it("can reject a tutor", function(){
    var cmpPromise = function(pw){ return new Promise(function(resolve){
        resolve(false);
      })
    };
    return test.load({Tutors: [{name: "a", pw:"test123"}]})
    .then(function(){
      return test.db.Users.authTutor("a", cmpPromise).then(function(isAuthorized){
        isAuthorized.should.be.false;
      });
    });
  });
  /**/
});
