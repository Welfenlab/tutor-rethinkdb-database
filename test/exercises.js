
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
var chaiThings = require("chai-things");

chai.use(chaiAsPromised);
chai.use(chaiThings);
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

  it("should hide solution information for a normal exercise query by id", function(){
    return test.load(
    {
      Exercises:[
        {id:1,activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON()),tasks:[
          {title: 'abc', maxPoints: 10, text: 'You should!', prefilled: {title: 'title 1', content: 'content 1'}, solutionTest: {}, solution: {}},
          {title: 'def', maxPoints: 12, text: 'You should too!', prefilled: {title: 'title 2', content: 'content 2'}, solution: {}},
          {title: 'ghi', maxPoints: 15, text: 'You should also!', prefilled: {title: 'title 3', content: 'content 3'}, solutionTest: {}}
        ]}
      ]
    }).then(function() {
      return test.db.Exercises.getById(1).then(function(ex){
        (Array.isArray(ex)).should.be.false;
        ex.id.should.equal(1);
        //ex.tasks.should.all.not.have.key("solution");
        for (var i = 0; i != ex.tasks.length; ++i) {
          ex.tasks[i].should.not.have.key("solution");
          ex.tasks[i].should.not.have.key("solutionTest");
        }
      });
    });
  });

  it("should not return an unactive exercise by id", function(){
    return test.load({Exercises:[
      {activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON()),id:1},
      {activationDate: rdb.ISO8601(moment().add(2, 'days').toJSON()),id:2}
    ]}).then(function() {
      return test.db.Exercises.getById(2).should.be.rejected;
    });
  });

  it("should hide solution information for a normal exercise query", function(){
    return test.load(
    {
      Exercises:[
        {id:1,activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON()),tasks:[
          {title: 'abc', maxPoints: 10, text: 'You should!', prefilled: {title: 'title 1', content: 'content 1'}},
          {title: 'def', maxPoints: 12, text: 'You should too!', prefilled: {title: 'title 2', content: 'content 2'}, solution: {}},
          {title: 'ghi', maxPoints: 15, text: 'You should also!', prefilled: {title: 'title 3', content: 'content 3'}, solution: {}}
        ]},
        {id:2,activationDate: rdb.ISO8601(moment().subtract(2, 'days').toJSON()),tasks:[
          {title: 'abc', maxPoints: 10, text: 'You should!', prefilled: {title: 'title 1', content: 'content 1'}, solutionTest: {}, solution: {}},
          {title: 'def', maxPoints: 12, text: 'You should too!', prefilled: {title: 'title 2', content: 'content 2'}, solution: {}},
          {title: 'ghi', maxPoints: 15, text: 'You should also!', prefilled: {title: 'title 3', content: 'content 3'}, solutionTest: {}}
        ]}
      ]
    }).then(function(){
      return test.db.Exercises.get().then(function(ex){
        (Array.isArray(ex)).should.be.true;
        ex.should.have.length(2);

        // note for future readers:
        // chai-things solution did not work
        for (var j = 0; j != ex.length; ++j)
          for (var i = 0; i != ex[j].tasks.length; ++i) {
            ex[j].tasks[i].should.not.have.key("solution");
            ex[j].tasks[i].should.not.have.key("solutionTest");
          }
      });
    });
  });
  it("should hide solution information for an active-exercise query", function(){
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
        ex[0].should.not.have.key("solutions");
      });
    });
  });

  it("should be able to get the users solution for an exercise", function(){
    return test.load({Solutions:[
      {group:"A",exercise: 1,solution:["text","textA"]},
      {group:2,exercise: 1,solution:["text2","textA2"]},
      {group:1,exercise: 2,solution:["text3","textA3"]},
      {group:"A",exercise: 2,solution:["text3","textA3"]}
    ], Groups: [
      {id: "A", users: [ 1 ],pendingUsers:[]},{id: 1, users: [ 2 ],pendingUsers:[]},{id: 2, users: [ 3 ],pendingUsers:[]}
    ], Users: [
      {id: 1, pseudonym: "a"},{id: 2, pseudonym: "b"},{id: 3, pseudonym: "c"}
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

  it("should hide unfinished tutor results", function(){
    return test.load({Solutions:[
      {group:"A",exercise: 1,solution:["text","textA"],results:"bla",inProcess:true,lock:"tutor"}
    ], Groups: [
      {id: "A", users: [ 1 ], pendingUsers:[]}
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

  it("should show finished tutor results", function(){
    return test.load({Solutions:[
      {group:"A",exercise: 1,solution:["text","textA"],results:"bla",inProcess:false}
    ], Groups: [
      {id: "A", users: [ 1 ], pendingUsers:[]}
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

  it("a non existing solution should return null", function(){
    return test.load({Solutions:[
      {group:"B",exercise: 1,solutions:["text","textA"]},
      {group:2,exercise: 1,solutions:["text2","textA2"]},
      {group:1,exercise: 2,solutions:["text3","textA3"]},
      {group:"A",exercise: 2,solutions:["text3","textA3"]}
    ], Groups: [
      {id: "A", users: [ 1 ], pendingUsers:[]}
    ], Users: [
      {id: 1, pseudonym: 1, solutions: []}
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
      {id: "A", users: [ 1 ], pendingUsers:[]}
    ], Users: [
      {id: 1, pseudonym: 1, solutions: []}
    ], Exercises: [
      {id: 1,
        activationDate: rdb.ISO8601(moment().subtract(7,"days").toJSON()),
        dueDate: rdb.ISO8601(moment().add(1, "days").toJSON())}
    ]})
    .then(function(){
      // FIXME
      return test.db.Exercises.createExerciseSolution(1,1).then(function(){
        return test.db.Exercises.getExerciseSolution(1,1).then(function(sol){
          (sol == null).should.be.false;
          sol.group.should.equal("A");
          sol.exercise.should.equal(1);
          return test.db.Users.get(1).then(function (usr) {
            (Array.isArray(usr.solutions)).should.be.true;
            usr.solutions.should.have.length(1)
          });
        });
      });
    });
  });

  it("should not create a solution if the exercise has expired", function(){
    return test.load({Solutions:[
    ], Groups: [
      {id: "A", users: [ 1 ], pendingUsers:[]}
    ], Users: [
      {id: 1, pseudonym: 1, solutions: []}
    ], Exercises: [
      {id: 1,
        activationDate: rdb.ISO8601(moment().subtract(7,"days").toJSON()),
        dueDate: rdb.ISO8601(moment().subtract(1, "days").toJSON())}
    ]})
    .then(function(){
      return test.db.Exercises.createExerciseSolution(1,1).should.be.rejected;
    });
  });

  it("should not create a solution for a not-yet active exercise", function(){
    return test.load({Solutions:[
    ], Groups: [
      {id: "A", users: [ 1 ], pendingUsers:[]}
    ], Users: [
      {id: 1, pseudonym: 1, solutions: []}
    ], Exercises: [
      {id: 1,
        activationDate: rdb.ISO8601(moment().add(1,"days").toJSON()),
        dueDate: rdb.ISO8601(moment().add(7, "days").toJSON())}
    ]})
    .then(function(){
      return test.db.Exercises.createExerciseSolution(1,1).should.be.rejected;
    });
  });

  /*
  it("should not create anything if user and group have solution", function() {
    return test.load({
      Solutions: [{id: 1, group: 1, exercise: 1}],
      Groups: [{id: "A", users: [ 1 ], pendingUsers:[]}],
      Users: [{id: 1, solutions: [1], pseudonym: "A"}],
      Exercises: [
        {id: 1, activationDate: rdb.ISO8601(moment().subtract(7,"days").toJSON()),
          dueDate: rdb.ISO8601(moment().add(1, "days").toJSON())}
      ]
    })
    .then(function() {
      return test.db.Exercises.createExerciseSolution(1, 1).should.be.resolved;
    });
  });
  */

  it("should create a solution if a user has none, but the group has, and update his solution field", function() {
    return test.load({Solutions:[
      {id: 1, group:1, exercise: 1,solution:["text","textA"]},
      {id: 2, group:3, exercise: 1,solution:["text2","textA2"]},
      {id: 3, group:2, exercise: 2,solution:["text3","textA3"]},
      {id: 4, group:1, exercise: 2,solution:["text3","textA3"]}
    ], Groups: [
      {id: 1, users: [ 1 ],pendingUsers:[]},
      {id: 2, users: [ 2 ],pendingUsers:[]},
      {id: 3, users: [ 3 ],pendingUsers:[]}
    ], Users: [
      {id: 1, pseudonym: "a", solutions: []},
      {id: 2, pseudonym: "b", solutions: []},
      {id: 3, pseudonym: "c", solutions: []}
    ], Exercises: [
      {id: 1,
        activationDate: rdb.ISO8601(moment().subtract(7,"days").toJSON()),
        dueDate: rdb.ISO8601(moment().add(1, "days").toJSON())}
    ]})
    .then(function() {
      return test.db.Exercises.createExerciseSolution(1, 1).then(function() {
        return test.db.Users.get(1).then(function(usr) {
          usr.solutions[0].should.equal(1);
        });
      });
    });
  });
});
