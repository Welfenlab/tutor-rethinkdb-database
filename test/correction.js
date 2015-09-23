
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
  /*
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
  });*/
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
      return test.db.Corrections.lockNextSolutionForTutor("tutor",3).should.be.rejected;
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
  it("has a method returning the correction status of all exercises", function(){
    return test.load({Solutions:[
      {exercise: 1, group: 1,  results:[],lock: "tutor",inProcess:false},
      {exercise: 1, group: 2},
      {exercise: 2, group: 1},
      {exercise: 2, group: 2, lock:"tutor"}
    ]})
    .then(function(){
      return test.db.Corrections.getStatus().then(function(status){
        status.should.have.length(2);
        bareStatus = _.map(status, function(s) { delete s.id; return s });
        status.should.deep.include.members([{exercise:1,solutions:2,corrected:1,locked:1},
              {exercise:2,solutions:2,corrected:0,locked:1}])
      });
    });
  });
  /**/
});
