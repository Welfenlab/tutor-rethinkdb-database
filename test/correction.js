
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.should();

var rdb = require("rethinkdb");
var _ = require("lodash");

var moment = require("moment");
var testUtils = require("./test_utils");

after(function(){
  return testUtils.closeConnection();
});

describe("Corretion methods", function(){
  var test = {db:null,cleanup:null,load:null};
  // setup a new fresh database for every test!
  beforeEach(testUtils.beforeTest(test));
  // remove the DB after each test
  afterEach(testUtils.afterTest(test));

  it("should return the number of pending corrections", function(){
    return test.load({Solutions:
      [
        {exercise: 1, group: 1, results:["stuff"]},
        {exercise: 1, group: 2},
        {exercise: 2, group: 1},
        {exercise: 2, group: 2}
      ]
    }).then(function(){
      return test.db.Corrections.getNumPending(1).then(function(pending){
        pending.should.equal(1);
      });
    });
  });
  it("can list all solutions for an exercise", function(){
    return test.load({Solutions:[
      {exercise: 1, group: 1},
      {exercise: 1, group: 2},
      {exercise: 2, group: 1},
      {exercise: 2, group: 2}
    ]}).then(function(){
      return test.db.Corrections.getSolutionsForExercise(1).then(function(sols){
        sols.should.have.length(2);
        bareSols = _.map(sols, function(s) { delete s.id; return s });
        bareSols.should.deep.include.members([{exercise: 1, group: 1},{exercise: 1, group: 2}]);
      });
    });
  });
  it("should lock a solution for a tutor", function(){
    return test.load({Solutions: [{id:1,exercise:1, group:1},{exercise:2,group:2}]})
    .then(function(){
      return test.db.Corrections.lockSolutionForTutor(1,1,"tutor").should.be.fulfilled;
    });
  });
  it("locking a solution twice should have no effect", function(){
    return test.load({Solutions: [{id:1,exercise:1, group:1},{exercise:2,group:2}]})
    .then(function(){
      return test.db.Corrections.lockSolutionForTutor(1,"tutor").then(function(){
        return test.db.Corrections.lockSolutionForTutor(1,"tutor");
      }).should.be.fulfilled;
    })
  });
  it("should not be able to lock a solution by two different tutors", function(){
    return test.load({Solutions: [{id:1,exercise:1, group:1},{exercise:2,group:2}]})
    .then(function(){
      return test.db.Corrections.lockSolutionForTutor(1,"tutor").then(function(){
        return test.db.Corrections.lockSolutionForTutor(1,"tutor2")
      }).should.be.rejected;
    });
  });
  it("solutions with results cannot be locked", function(){
    return test.load({Solutions: [{id:1,exercise:1, group:1,results:[]},{exercise:2,group:2}]})
    .then(function(){
      return test.db.Corrections.lockSolutionForTutor(1,"tutor").should.be.rejected;
    });
  });
  it("should lock a random not corrected solution", function(){
    return test.load({Solutions: [{exercise:1, group:1, results:[]},{exercise:1,group:2}]})
    .then(function(){
      return test.db.Corrections.lockNextSolutionForTutor(1,"tutor").then(function(){
        return test.db.Corrections.getSolutionsForGroup(2).then(function(sol){
          sol[0].lock.should.equal("tutor");
        });
      });
    });
  });

  it("should fail if no exercise could be locked", function(){
    return test.load({Solutions: [{exercise:1, group:1, result:[]},{exercise:2,group:2}]})
    .then(function(){
      return test.db.Corrections.lockNextSolutionForTutor(3,"tutor").should.be.rejected;
    });
  });

  it("has a method returning the correction status of all exercises", function(){
    return test.load({Solutions:[
      {exercise: 1, group: 1, results:[]},
      {exercise: 1, group: 2},
      {exercise: 2, group: 1},
      {exercise: 2, group: 2, lock:"tutor"}
    ]})
    .then(function(){
      return test.db.Corrections.getStatus().then(function(status){
        status.should.have.length(2);
        bareStatus = _.map(status, function(s) { delete s.id; return s });
        status.should.deep.include.members([{exercise:1,solutions:2,corrected:1,locked:0},
              {exercise:2,solutions:2,corrected:0,locked:1}])
      });
    });
  });
  /**/
});
