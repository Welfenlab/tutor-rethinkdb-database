
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
    return test.db.Manage.storeTutor({name:"t",password:"ABC",contingent:"SALT"}).then(function(){
      return test.db.Manage.listTutors().then(function(tutors){
        tutors.should.have.length(1);
        tutors[0].name.should.equal("t");
      });
    });
  });
  it("should fail if a tutor object is invalid", function(){
    return test.db.Manage.storeTutor({name:"t",pw:"ABC",contingent:"SALT"}).should.be.rejected;
  });
  it("should update an existing tutor", function(){
    return test.load({Tutors:[{name:"t",pw:"BCD"}]})
    .then(function(){
      return test.db.Manage.storeTutor({name:"t",password:"ABC",contingent:"SALT"}).then(function(){
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
});
