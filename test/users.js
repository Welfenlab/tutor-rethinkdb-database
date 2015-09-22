
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
    return test.db.Users.create(1,"12345678","P").then(function(){
      return test.db.Users.get(1).then(function(u){
        u.pseudonym.should.equal("P");
        u.id.should.equal(1);
        u.matrikel.should.equal("12345678");
      });
    });
  });
  it("should not be possible to create two users with the same id", function(){
    return test.load({Users:[{id:1,pseudonym:"P"}]})
    .then(function(){
      return test.db.Users.create(1,"12345678","Q").should.be.rejected;
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

  it("can query a non existing user without error", function(){
    return test.db.Users.getTutor("nonExisting").then(function(tutor){
      tutor.name.should.equal("nonExisting");
      tutor.should.have.any.key("salt");
    });
  });

  it("can authorize a tutor", function(){
    return test.load({Tutors: [{name: "a", pw:"test123"}]})
    .then(function(){
      return test.db.Users.authTutor("a", "test123").then(function(isAuthorized){
        isAuthorized.should.be.true;
      });
    });
  });
  /**/
});
