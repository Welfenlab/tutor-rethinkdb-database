
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

describe("Managing methods", function(){
  var test = {db:null,cleanup:null,load:null};
  // setup a new fresh database for every test!
  beforeEach(testUtils.beforeTest(test));
  // remove the DB after each test
  afterEach(testUtils.afterTest(test));

  it("should create a new tutor", function(){
    return test.db.Manage.storeTutor("t","ABC","SALT").then(function(){
      return test.db.Manage.listTutors().then(function(tutors){
        tutors.should.have.length(1);
        tutors[0].name.should.equal("t");
      });
    });
  });
  it("should update an existing tutor", function(){
    return test.load({Tutors:[{name:"t",pw:"BCD"}]})
    .then(function(){
      return test.db.Manage.storeTutor("t","ABC","SALT").then(function(){
        return test.db.Manage.listTutors().then(function(tutors){
          tutors.should.have.length(1);
          tutors[0].name.should.equal("t");
        });
      });
    });
  });
  it("should create a new exercise for a new ID", function(){
    return test.db.Manage.storeExercise({id:1, activationDate: moment().toJSON(), dueDate: moment().toJSON()}).then(function(){
      return test.db.Manage.listExercises().then(function(exercises){
        exercises.should.have.length(1);
        exercises[0].id.should.equal(1);
      })
    });
  });
  it("should update an existing exercise by ID", function(){
    return test.load({Exercises:[{id:1,number:2, activationDate: moment().toJSON(), dueDate: moment().toJSON()}]})
    .then(function(){
      return test.db.Manage.storeExercise({id:1,number:1, activationDate: moment().toJSON(), dueDate: moment().toJSON()}).then(function(){
        return test.db.Manage.listExercises().then(function(exercises){
          exercises.should.have.length(1);
          exercises[0].id.should.equal(1);
          exercises[0].number.should.equal(1);
        });
      });
    });
  });
  it("should list all tutors without password", function(){
    return test.load({Tutors:[{name: "a", pw:"no"},{name: "b", pw:"nono"}]})
    .then(function(){
      return test.db.Manage.listTutors().then(function(tutors){
        tutors.should.have.length(2);
        tutors[0].should.have.key("name");
        tutors[1].should.not.have.key("pw");
      });
    });
  });
  it("should update the oldest solution", function() {
    return test.load({
      Exercises: [
        {id:1,number:1, activationDate: rdb.ISO8601(moment().toJSON()), dueDate: rdb.ISO8601(moment().toJSON()),
        tasks: [{id: 0, number: 1, maxPoints: 10, solution: "Loesung", text: "Text"}]}
      ],
      Solutions: [
        {
          exercise: 1,
          group: 16,
          id: 256,
          lastStore: rdb.now().sub(350),
          tasks: []
        },
      ],
      Groups: [
        {id:16, pendingUsers: [], users: [4096]}
      ],
      Users: [
        {id:4096, pseudonym: "Slick Dijkstra"}
      ],
      ShareJsTable: [{id:"16:1:1", _data:""}]
    })
    .then(function() {
      return test.db.Manage.updateOldestSolution(300).then(function(results) {
        results.replaced.should.equal(1);
        results.errors.should.equal(0);
      });
    });
  });
});
