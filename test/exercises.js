
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

describe("Student Exercise Queries", function(){
  var test = {db:null,cleanup:null,load:null};
  // setup a new fresh database for every test!
  beforeEach(testUtils.beforeTest(test));
  // remove the DB after each test
  afterEach(testUtils.afterTest(test));

  it("should filter not activated exercises", function(){
    return test.load(
    {
      "Exercises": [
        {activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON())},
        {activationDate: rdb.ISO8601(moment().add(2, 'days').toJSON())}
      ]
    }).then(function(){
      return test.db.Exercises.get().then(function(ex){
        ex.should.have.length(1);
      });
    });
  });
  it("should return an exercise by id", function(){
    return test.load(
    {
      Exercises:[
        {activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON()),id:1},
        {activationDate: rdb.ISO8601(moment().add(2, 'days').toJSON()),id:2}
      ]
    }).then(function(){
      return test.db.Exercises.getById(1).then(function(ex){
        ex.id.should.equal(1);
      });
    });
  });
  it("should not return an unactive exercise by id", function(){
    return test.load(
    {
      Exercises:[
        {activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON()),id:1},
        {activationDate: rdb.ISO8601(moment().add(2, 'days').toJSON()),id:2}
      ]
    }).then(function(){
      return test.db.Exercises.getById(2).should.be.rejected;
    });
  });

  it("should be able to query all active exercises", function(){
    return test.load(
    {
      Exercises:[
        {activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON()),dueDate: rdb.ISO8601(moment().add(2, 'days').toJSON())},
        {activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON()),dueDate: rdb.ISO8601(moment().subtract(1, 'days').toJSON())},
        {activationDate: rdb.ISO8601(moment().add(2, 'days').toJSON()),dueDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON())}
      ]
    }).then(function(){
      return test.db.Exercises.getAllActive().then(function(ex){
        ex.length.should.equal(1);
      });
    });
  });

  it("should hide task information for a normal exercise query by id", function(){
    return test.load(
    {
      Exercises:[
        {id:"abc",activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON()),tasks:[],solutions:[]}
      ]
    }).then(function(){
      return test.db.Exercises.getById("abc").then(function(ex){
        (Array.isArray(ex)).should.be.false;
        ex.id.should.equal("abc");
        ex.should.not.have.key("tasks");
        ex.should.not.have.key("solutions");
      });
    });
  });
  it("should hide task information for a normal exercise query", function(){
    return test.load(
    {
      Exercises:[
        {id:"abc",activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON()),tasks:[],solutions:[]}
      ]
    }).then(function(){
      return test.db.Exercises.get().then(function(ex){
        (Array.isArray(ex)).should.be.true;
        ex.should.have.length(1)
        ex[0].should.not.have.key("tasks");
        ex[0].should.not.have.key("solutions");
      });
    });
  });
  it("should hide task information for an active-exercise query", function(){
    return test.load(
    {
      Exercises:[
        {id:"abc",activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON()),
                  dueDate: rdb.ISO8601(moment().add(2, 'days').toJSON()),tasks:[],solutions:[]}
      ]
    }).then(function(){
      return test.db.Exercises.getAllActive().then(function(ex){
        (Array.isArray(ex)).should.be.true;
        ex.should.have.length(1)
        ex[0].should.not.have.key("tasks");
        ex[0].should.not.have.key("solutions");
      });
    });
  });

  it("detailed exercises should hide solution information", function(){
    return test.load(
    {
      Exercises:[
        {id:"abc",activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON()),
                  dueDate: rdb.ISO8601(moment().add(2, 'days').toJSON()),tasks:[],solutions:[]}
      ]
    }).then(function(){
      return test.db.Exercises.getDetailed("abc").then(function(ex){
        (Array.isArray(ex)).should.be.false;
        ex.should.not.have.key("solutions");
      });
    });
  });
  it("should be able to get detailed information for an exercise", function(){
    return test.load(
    {
      Exercises:[
        {id:"abc",activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON()),tasks:[{id:"a",text:"b"}]},
        {id:"cde",activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON())},
        {id:"efg",activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON())}
      ]
    }).then(function(){
      return test.db.Exercises.getDetailed("abc").then(function(ex){
        (Array.isArray(ex)).should.be.false;
        ex.id.should.equal("abc");
        (Array.isArray(ex.tasks)).should.be.true;
        ex.tasks.should.have.length(1);
        ex.tasks[0].text.should.equal("b");
      });
    });
  });
  it("should be able to get the solution for an exercise", function(){
    return test.load({Solutions:[
      {group:"A",exercise: 1,solution:["text","textA"]},
      {group:2,exercise: 1,solution:["text2","textA2"]},
      {group:1,exercise: 2,solution:["text3","textA3"]},
      {group:"A",exercise: 2,solution:["text3","textA3"]}
    ], Groups: [
      {id: "A", users: [ 1 ]}
    ], Users: [
      {id: 1, pseudonym: 1}
    ], Exercises: [
      {id: 1,
        activationDate: rdb.ISO8601(moment().subtract(7,"days").toJSON()),
        dueDate: rdb.ISO8601(moment().add(1, "days").toJSON())}
    ]})
    .then(function(){
      return test.db.Exercises.getExerciseSolution(1,1).then(function(sol){
        (Array.isArray(sol)).should.be.false;
        sol.solution.should.deep.include.members(["text","textA"])
      });
    });
  });

  it("should hide unfinished results", function(){
    return test.load({Solutions:[
      {group:"A",exercise: 1,solution:["text","textA"],results:"bla",inProcess:true,lock:"tutor"}
    ], Groups: [
      {id: "A", users: [ 1 ]}
    ], Users: [
      {id: 1, pseudonym: 1}
    ], Exercises: [
      {id: 1,
        activationDate: moment().subtract(7,"days").toJSON(),
        dueDate: moment().add(1, "days").toJSON()}
    ]})
    .then(function(){
      return test.db.Exercises.getExerciseSolution(1,1).then(function(sol){
        (Array.isArray(sol)).should.be.false;
        sol.should.not.have.key("results");
        sol.should.not.have.key("inProcess");
        sol.should.not.have.key("lock");
      });
    });
  });

  it("should show finished results", function(){
    return test.load({Solutions:[
      {group:"A",exercise: 1,solution:["text","textA"],results:"bla",inProcess:false}
    ], Groups: [
      {id: "A", users: [ 1 ]}
    ], Users: [
      {id: 1, pseudonym: 1}
    ], Exercises: [
      {id: 1,
        activationDate: moment().subtract(7,"days").toJSON(),
        dueDate: moment().add(1, "days").toJSON()}
    ]})
    .then(function(){
      return test.db.Exercises.getExerciseSolution(1,1).then(function(sol){
        (Array.isArray(sol)).should.be.false;
        sol.should.have.any.keys("results");
        sol.should.not.have.key("inProcess");
      });
    });
  });

  it("a non existing solution should return an empty object", function(){
    return test.load({Solutions:[
      {group:"B",exercise: 1,solutions:["text","textA"]},
      {group:2,exercise: 1,solutions:["text2","textA2"]},
      {group:1,exercise: 2,solutions:["text3","textA3"]},
      {group:"A",exercise: 2,solutions:["text3","textA3"]}
    ], Groups: [
      {id: "A", users: [ 1 ]}
    ], Users: [
      {id: 1, pseudonym: 1}
    ], Exercises: [
      {id: 1,
        activationDate: rdb.ISO8601(moment().subtract(7,"days").toJSON()),
        dueDate: rdb.ISO8601(moment().add(1, "days").toJSON())}
    ]})
    .then(function(){
      return test.db.Exercises.getExerciseSolution(1,1).then(function(sol){
        (sol == null).should.be.true;
      });
    });
  });

  it("should add a solution if there is none", function(){
    return test.load({Groups: [
      {id: "A", users: [ 1 ]}
    ], Users: [
      {id: 1, pseudonym: 1}
    ], Exercises: [
      {id: 1,
        activationDate: rdb.ISO8601(moment().subtract(7,"days").toJSON()),
        dueDate: rdb.ISO8601(moment().add(1, "days").toJSON())}
    ]})
    .then(function(){
      return test.db.Exercises.setExerciseSolution(1,1,["abc","cde"]).then(function(){
        return test.db.Exercises.getExerciseSolution(1,1).then(function(sol){
          (Array.isArray(sol)).should.be.false;
          sol.solution.should.deep.include.members(["abc","cde"])
        });
      });
    });
  });
  it("should update a solution if there is one", function(){
    return test.load({Solutions:[
      {group:"A",exercise: 1,solution:["text","textA"]}
    ], Groups: [
      {id: "A", users: [ 1 ]}
    ], Users: [
      {id: 1, pseudonym: 1}
    ], Exercises: [
      {id: 1,
        activationDate: rdb.ISO8601(moment().subtract(7,"days").toJSON()),
        dueDate: rdb.ISO8601(moment().add(1, "days").toJSON())}
    ]})
    .then(function(){
      return test.db.Exercises.setExerciseSolution(1,1,["abc","cde"]).then(function(){
        return test.db.Exercises.getExerciseSolution(1,1).then(function(sol){
          (Array.isArray(sol)).should.be.false;
          sol.solution.should.deep.include.members(["abc","cde"])
        });
      });
    });
  });

  it("should not update a solution if the exercise has expired", function(){
    return test.load({Solutions:[
      {group:"A",exercise: 1,solution:["text","textA"]}
    ], Groups: [
      {id: "A", users: [ 1 ]}
    ], Users: [
      {id: 1, pseudonym: 1}
    ], Exercises: [
      {id: 1,
        activationDate: rdb.ISO8601(moment().subtract(7,"days").toJSON()),
        dueDate: rdb.ISO8601(moment().subtract(1, "days").toJSON())}
    ]})
    .then(function(){
      return test.db.Exercises.setExerciseSolution(1,1,["abc","cde"]).should.be.rejected;
    });
  });

  it("should not update a solution for a not-yet active exercise", function(){
    return test.load({Solutions:[
      {group:"A",exercise: 1,solution:["text","textA"]}
    ], Groups: [
      {id: "A", users: [ 1 ]}
    ], Users: [
      {id: 1, pseudonym: 1}
    ], Exercises: [
      {id: 1,
        activationDate: rdb.ISO8601(moment().add(1,"days").toJSON()),
        dueDate: rdb.ISO8601(moment().add(7, "days").toJSON())}
    ]})
    .then(function(){
      return test.db.Exercises.setExerciseSolution(1,1,["abc","cde"]).should.be.rejected;
    });
  });
});
