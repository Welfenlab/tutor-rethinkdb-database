/* global it */

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

describe("Correction methods", function(){
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
  it("should return the processed flag", function() {
    return test.load({
      Solutions: [
        {id: 0, processed: false},
        {id: 1, processed: true}
      ]
    }).then(function() {
      return test.db.Corrections.hasPdf(0).then(function(has) {
        has.should.equal(false);
        return test.db.Corrections.hasPdf(1).then(function(has2) {
          has2.should.equal(true);
        });
      });
    });
  });
  it("lists all pending corrections for a tutor", function(){
    return test.load({Solutions:[{id: 1, lock:"tutor",inProcess:true},{id: 2, lock:"tutor"},{id: 3, lock:"tutor", inProcess:false}]})
    .then(function(){
      return test.db.Corrections.getUnfinishedSolutionsForTutor("tutor").then(function(sol){
        sol.should.have.length(1);
        sol[0].id.should.equal(1);
      });
    });
  });
  it("lists all finished solutions for a tutor", function () {
    return test.load({
      Solutions: [
        {id: 1, lock:"tutor",inProcess:true},
        {id: 2, lock:"tutor"},
        {id: 3, lock:"tutor",inProcess:false}
      ]})
    .then(function() {
      return test.db.Corrections.getFinishedSolutionsForTutor("tutor").then(function(sol) {
        sol.should.have.length(1);
        sol[0].id.should.equal(3);
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
  /*
  it("should be possible to store results for a locked solution", function(){
    return test.load({Solutions:[{id:1, lock:"tutor"}]})
    .then(function(){
      return test.db.Corrections.setResultForExercise("tutor",1,["res"]).then(function(){
        return test.db.Corrections.getResultForExercise(1).then(function(sol){
          (sol == null).should.be.false;
          sol.result.should.deep.equal(["res"]);
        })
      });
    });
  });
  */
  it("should not be possibe to lock more than 10 solutions by a single tutor", function() {
    return test.load(
      {Solutions: [
        {exercise: 1, id:1, lock:"Hans", inProcess: false},
        {exercise: 1, id:2, lock:"Hans", inProcess: true},
        {exercise: 1, id:3, lock:"Hans", inProcess: true},
        {exercise: 1, id:4, lock:"Hans", inProcess: false},
        {exercise: 1, id:5, lock:"Hans", inProcess: true},
        {exercise: 1, id:6, lock:"Hans", inProcess: true},
        {exercise: 1, id:7, lock:"Hans", inProcess: true},
        {exercise: 1, id:8, lock:"Hans", inProcess: true},
        {exercise: 1, id:9, lock:"Hans", inProcess: true},
        {exercise: 1, id:10, lock:"Hans", inProcess: true},
        {exercise: 1, id:12, lock:"Hans", inProcess: true},
        {exercise: 1, id:13, lock:"Hans", inProcess: true},
        {exercise: 1, id:14, lock:"Hans", inProcess: true},
        {exercise: 1, id:11}, {exercise: 1, id:12}],
       Tutors: [{name: "Hans"}]})
    .then(function() {
      return test.db.Corrections.lockNextSolutionForTutor("Hans", 1).should.be.rejected;
    });
  });
  it("should create a time stamp when locking a solution", function () {
    return test.load({Solutions: [{exercise: 1, group: 2}]})
    .then(function() {
      return test.db.Corrections.lockNextSolutionForTutor("tutor", 1).then(function(sol) {
        sol.should.have.property("lockTimeStamp");
      });
    });
  });
  //---------------------------------------------------------------------
  // Locks
  //---------------------------------------------------------------------
  it("should not be possible to store results for a not locked solution", function(){
    return test.load({Solutions:[{id:1}]})
    .then(function(){
      return test.db.Corrections.setResultForExercise("tutor",1,["res"]).should.be.rejected;
    });
  });
  it("should not be possible to store results for a solution locked by another tutor", function(){
    return test.load({Solutions:[{id:1, lock:"tutor2"}]})
    .then(function(){
      return test.db.Corrections.setResultForExercise("tutor",1,["res"]).should.be.rejected;
    });
  });
  it("should be possible to store for a solution locked by the tutor", function(){
    return test.load({Solutions:[{id:1, lock:"tutor"}]})
    .then(function(){
      return test.db.Corrections.setResultForExercise("tutor",1,["res"]).should.be.fulfilled;
    });
  });
  it("should lock a solution for a tutor", function(){
    return test.load({Solutions: [{id:1,exercise:1, group:1},{exercise:2,group:2}]})
    .then(function(){
      return test.db.Corrections.lockSolutionForTutor("tutor",1).should.be.fulfilled;
    });
  });
  it("locking a solution twice should have no effect", function(){
    return test.load({Solutions: [{id:1,exercise:1, group:1},{exercise:2,group:2}]})
    .then(function(){
      return test.db.Corrections.lockSolutionForTutor("tutor",1).then(function(){
        return test.db.Corrections.lockSolutionForTutor("tutor",1);
      }).should.be.fulfilled;
    })
  });
  it("should not be able to lock a solution by two different tutors", function(){
    return test.load({Solutions: [{id:1,exercise:1, group:1},{exercise:2,group:2}]})
    .then(function(){
      return test.db.Corrections.lockSolutionForTutor("tutor",1).then(function(){
        return test.db.Corrections.lockSolutionForTutor("tutor2",1)
      }).should.be.rejected;
    });
  });
  it("solutions with results cannot be locked", function(){
    return test.load({Solutions: [{id:1,exercise:1, group:1,results:[]},{exercise:2,group:2}]})
    .then(function(){
      return test.db.Corrections.lockSolutionForTutor("tutor",1).should.be.rejected;
    });
  });
  //---------------------------------------------------------------------
  it("should lock a random not corrected solution", function(){
    return test.load({Solutions: [{exercise:1, group:1, results:[]},{exercise:1,group:2}]})
    .then(function(){
      return test.db.Corrections.lockNextSolutionForTutor("tutor",1).then(function(){
        return test.db.Corrections.getSolutionsForGroup(2).then(function(sol){
          sol[0].lock.should.equal("tutor");
        });
      });
    });
  });
  it("should mark a newly locked solution as 'inProcess'", function(){
    return test.load({Solutions: [{exercise:1,group:2}]})
    .then(function(){
      return test.db.Corrections.lockNextSolutionForTutor("tutor",1).then(function(sol){
        sol.inProcess.should.be.true;
      });
    });
  });
  it("should fail if no exercise could be locked", function(){
    return test.load({Solutions: [{exercise:1, group:1, result:[]},{exercise:2,group:2}]})
    .then(function(){
      return test.db.Corrections.lockNextSolutionForTutor("tutor",3).then(function(res){
        (res === undefined).should.be.true;
      });
    });
  });
  it("should finalize a solution by setting the 'inProcess' marker to false", function(){
    return test.load({Solutions: [{id:1,results:[],lock:"tutor",inProcess:true}]})
    .then(function(){
      return test.db.Corrections.finishSolution("tutor",1).then(function(){
        return test.db.Corrections.getUnfinishedSolutionsForTutor("tutor").then(function(sols){
          sols.should.have.length(0);
        });
      });
    });
  });

  it("should not finalize a solution of another tutor", function(){
    return test.load({Solutions: [{id:1,results:[],lock:"tutor",inProcess:true}]})
    .then(function(){
      return test.db.Corrections.finishSolution("tutor2",1).should.be.rejected;
    });
  });

  it("should not finalize a solution without results", function(){
    return test.load({Solutions: [{id:1,lock:"tutor",inProcess:true}]})
    .then(function(){
      return test.db.Corrections.finishSolution("tutor2",1).should.be.rejected;
    });
  });

  it("should list all unfinished exercises for a tutor", function(){
    return test.load({Solutions: [{id:1,lock:"tutor",inProcess:true},{id:1,lock:"tutor",inProcess:false}]})
    .then(function(){
      return test.db.Corrections.getUnfinishedSolutionsForTutor("tutor").then(function(sols){
        sols.should.have.length(1);
      });
    });
  });
  it("can get a solution by id", function(){
    return test.load({Solutions: [{id:1}]})
    .then(function(){
      return test.db.Corrections.getSolutionById(1).then(function(s){
        s.id.should.equal(1);
      });
    });
  });

  it("has a method returning the correction status of all exercises", function(){
    var date = moment().subtract(1, "days").toJSON();
    return test.load({Solutions:[
      {exercise: 1, group: 1, results:[],lock: "tutor",inProcess:false},
      {exercise: 1, group: 2},
      {exercise: 2, group: 1, lock:"blubb",inProcess:true},
      {exercise: 2, group: 2}
    ],Exercises:[
      {id: 1, activationDate: rdb.ISO8601(date)},
      {id: 2, activationDate: rdb.ISO8601(date)}
    ],Tutors: [
      {name:"tutor", contingent:1}
    ]})
    .then(function(){
      return test.db.Corrections.getStatus("tutor").then(function(status){
        status.should.have.length(2);
        bareStatus = _.map(status, function(s) { delete s.id; delete s.exercise.activationDate; return s });
        bareStatus.should.deep.include.members([
          {
            exercise:{id: 1},
            should: 2,
            is: 1,
            solutions:2,corrected:1,locked:1
          },
          {
            exercise:{id: 2},
            should: 2,
            is: 0,
            solutions:2,corrected:0,locked:1
          }]);
      });
    });
  });

  it("returns only queried unfinished exercises", function() {
    return test.load({Solutions: [{id:1,exercise:1,lock:"tutor",inProcess:true},
                                  {id:2,lock:"tutor",inProcess:false}]})
    .then(function() {
      return test.db.Corrections.getUnfinishedSolutionsForTutor("tutor").then(function(sols){
        sols.should.have.length(1);
      });
    });
  });

  it("has a method that lists all solutions of a user", function(){
    return test.load({Solutions: [{id:1,group:1,exercise:1}],
                      Groups: [{id:1,users:[2],pendingUsers:[]}],
                      Users: [{id:2, pseudonym:"A"}]})
    .then(function() {
      return test.db.Corrections.getUserSolutions(2).then(function(sols){
        sols.should.have.length(1);
        sols.should.deep.include.members([{id:1,group:1,exercise:1}]);
      });
    });
  });

  it("can calculate the contingent for an exercise and tutor", function(){
    return test.load({Tutors:[{name:"a",contingent:20},{name:"b",contingent:10}],
      Solutions:[{exercise:1},{exercise:1,lock:"a",inProcess:false},{exercise:1},{exercise:2}]
    })
    .then(function(){
      return test.db.Corrections.getExerciseContingentForTutor("a",1).then(function(contingent){
        contingent.should.should.equal(2);
        contingent.is.should.equal(1);
      });
    });
  });

  it("can get a specific solution for a user", function(){
    return test.load({Solutions: [{id:1,group:1,exercise:1},{id:2,group:1,exercise:2},{id:3,group:2,exercise:2}],
              Groups: [{id:1,users:[2], pendingUsers:[]}],
              Users: [{id:2,pseudonym:"B"}]})
    .then(function(){
      return test.db.Corrections.getUserExerciseSolution(2,2).then(function(sols){
        sols.id.should.equal(2);
      });
    });
  });
  
  it('checks the results object for existence', function() {
    return test.load({Solutions: [{id:1}]})
    .then(function() {
      return test.db.Corrections.checkResults(1).should.be.rejected
    })
  })
  
  it('checks that the results object has a points field', function() {
    return test.load({Solutions: [{id:1,results:''}]})
    .then(function() {
      return test.db.Corrections.checkResults(1).should.be.rejected
    })
  })
  
  it('checks that the format of the points field is valid', function() {
    var date = moment().subtract(1, "days").toJSON();
    return test.load({Solutions: [{id:1,exercise:1,results:{points:["1"]}}],
      Exercises: [{id:1,tasks:[1], activationDate: rdb.ISO8601(date)}]})
    .then(function() {
      return test.db.Corrections.checkResults(1).should.be.rejected
    })
  })
  
  it('should verify a valid results entry', function() {
    var date = moment().subtract(1, "days").toJSON();
    return test.load({Solutions: [{id:1,exercise:1,results:{points:[1,2]}}],
      Exercises: [{id:1,tasks:[1,3], activationDate: rdb.ISO8601(date)}]})
    .then(function() {
      return test.db.Corrections.checkResults(1).should.be.fulfilled
    })
  })
  
  it('should verify a stored result', function() {
    var date = moment().subtract(1, "days").toJSON();
    return test.load({Solutions: [{id:1,exercise:1, lock: 'XY'}],
      Exercises: [{id:1,tasks:[1,3], activationDate: rdb.ISO8601(date)}]})
    .then(function() {
      return test.db.Corrections.setResultForExercise("XY", 1, {pages:[],points:[1,2]}).then(function() {
        return test.db.Corrections.checkResults(1)
      }).should.be.fulfilled
    })
  })
  /**/
});
