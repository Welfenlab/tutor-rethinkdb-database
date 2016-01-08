
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
    return test.db.Manage.storeTutor({name:"t",password:"ABC",contingent:1}).then(function(){
      return test.db.Manage.listTutors().then(function(tutors){
        tutors.should.have.length(1);
        tutors[0].name.should.equal("t");
      });
    });
  });
  it("should fail if a tutor object is invalid", function(){
    return test.db.Manage.storeTutor({name:"t",pw:"ABC",contingent:1}).should.be.rejected;
  });

  it("should fail if a tutor object is invalid", function(){
    return test.db.Manage.storeTutor({name:"t",password:"ABC",contingent:"1"}).should.be.rejected;
  });
  it("should update an existing tutor", function(){
    return test.load({Tutors:[{name:"t",pw:"BCD"}]})
    .then(function(){
      return test.db.Manage.storeTutor({name:"t",password:"ABC",contingent:2}).then(function(){
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

  it("should create correct dates for an exercise", function(){
    return test.db.Manage.storeExercise(
      {
        id:1,
        activationDate: moment().subtract(1, "days").toJSON(),
        dueDate: moment().add(1, "days").toJSON()
      }).then(function(){
      return test.db.Exercises.getAllActive().then(function(exercises){
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
  it("should copy over all final solutions ", function() {
    return test.load({
      Exercises: [
        {
          id: 1,
          dueDate: rdb.ISO8601(moment().subtract(1, "h").toJSON()),
          tasks: [{number: 1}, {number: 2}]
        },
        {
          id: 2,
          dueDate: rdb.ISO8601(moment().add(1, "h").toJSON()),
          tasks: [{number: 2}]
        }
      ],
      Solutions: [
        {
          exercise: 1,
          group: 16,
          id: 1
        },
        {
          exercise: 1,
          group: 16,
          id: 2
        },
        {
          exercise: 2,
          group: 16,
          id: 3
        }
      ],
      ShareJS: [
        {id: "16:1:1"},
        {id: "16:1:2"}
      ]
    })
    .then(function() {
      return test.db.Manage.storeAllFinalSolutions().then(function(solutions) {
        return _.forEach(solutions, function(n, key) {
          n.finalSolutionStored.should.equal(true);
          n.tasks.should.have.length(2);
          n.tasks[0].id.should.equal("16:1:1");
          n.tasks[1].id.should.equal("16:1:2");
        });
      });
    });
  });
  it("has a query method for solutions", function(){
    return test.load({
      Solutions: [
        {id: "12", exercise: 1, group: 1, results:{points: 4}, inProcess: false},
        {id: "22", exercise: 2, group: 1, results:{points: 12}, inProcess: false},
        {id: "33", exercise: 1, group: 2, results:{points: 12}, inProcess: false}
      ]
    }).then(function(){
      return test.db.Manage.querySolutions('2').then(function(list){
        list.should.have.length(2)
        list[0].should.not.have.key("pdf")
      })
    })
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
      ShareJS: [{id:"16:1:1", _data:""}]
    })
    .then(function() {
      return test.db.Manage.updateOldestSolution(300).then(function(results) {
        results.replaced.should.equal(1);
        results.errors.should.equal(0);
      });
    });
  });
  it("should do nothing when updating the oldest solution if there is none", function() {
    return test.load({
      Exercises: [
        {id:1,number:1, activationDate: rdb.ISO8601(moment().toJSON()), dueDate: rdb.ISO8601(moment().toJSON()),
        tasks: [{id: 0, number: 1, maxPoints: 10, solution: "Loesung", text: "Text"}]}
      ],
      Solutions: [
      ],
      Groups: [
        {id:16, pendingUsers: [], users: [4096]}
      ],
      Users: [
        {id:4096, pseudonym: "Slick Dijkstra"}
      ]
    })
    .then(function() {
      return test.db.Manage.updateOldestSolution(300).should.be.fulfilled;
    });
  });
  /*
  it("should store a final solution sample", function() {
    return test.load({
      Exercises: [
        {id:1,number:1, activationDate: rdb.ISO8601(moment().toJSON()), dueDate: rdb.ISO8601(moment().subtract(1, 'days').toJSON()),
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
      ShareJS: [{id:"16:1:1", _data:""}]
    })
    .then(function() {
      return test.db.Manage.storeFinalSolutionSample().should.be.fulfilled;
    });
  });
  */
  /*
  it("should do nothing on storing a final solution sample, if there is none", function() {
    return test.load({
      Exercises: [
        {id:1,number:1, activationDate: rdb.ISO8601(moment().toJSON()), dueDate: rdb.ISO8601(moment().subtract(1, 'days').toJSON()),
        tasks: [{id: 0, number: 1, maxPoints: 10, solution: "Loesung", text: "Text"}]}
      ],
      Solutions: [
      ],
      Groups: [
        {id:16, pendingUsers: [], users: [4096]}
      ],
      Users: [
        {id:4096, pseudonym: "Slick Dijkstra"}
      ],
      ShareJS: [{id:"16:1:1", _data:""}]
    })
    .then(function() {
      return test.db.Manage.storeFinalSolutionSample().should.be.fulfilled;
    });
  });
  */
  it("should list all solutions for users", function(){
    return test.load({
      Solutions: [
        {id: 1, exercise: 1, group: 1, results:{points: 4}, inProcess: false},
        {id: 2, exercise: 2, group: 1, results:{points: 12}, inProcess: false},
        {id: 3, exercise: 1, group: 2, results:{points: 12}, inProcess: false}
      ],
      Groups: [
        {id: 1, users: [1, 2], pendingUsers:[]},
        {id: 2, users: [3], pendingUsers:[]}
      ], Users: [
        {id: 1, pseudonym: "A", solutions: []},
        {id: 2, pseudonym: "B", solutions: [1]},
        {id: 3, pseudonym: "C", solutions: [3]}
      ]
    }).then(function(){
      return test.db.Manage.getStudentsSolutions(3).then(function(sols){
        sols.should.have.length(1);
        sols[0].should.not.have.key("pdf");
      });
    });
  });
  it("list solutions for an user creates an error when the user does not exist", function(){
    return test.load({
      Users: [
        { id: 100, pseudonym: "A", solutions: [] }
      ]
    }).then(function(){
      return test.db.Manage.getStudentsSolutions("a").should.be.rejected;
    })
  });
  it("should lock a solution for the pdf processor", function() {
    return test.load({
      Exercises: [
        {
          id: 1,
          dueDate: rdb.ISO8601(moment().subtract(1, "h").toJSON()),
          tasks: [{number: 1}, {number: 2}]
        },
        {
          id: 2,
          dueDate: rdb.ISO8601(moment().subtract(1, "h").toJSON()),
          tasks: [{number: 2}]
        }
      ],
      Solutions: [
        {
          exercise: 1,
          group: 16,
          id: 1
        },
        {
          exercise: 2,
          group: 16,
          id: 3,
          processed: true
        }
      ],
      ShareJS: [
        {id: "16:1:1"},
        {id: "16:1:2"}
      ]
    }).then(function(){
      return test.db.Manage.lockSolutionForPdfProcessor().then(function(result) {
        result.exercise.should.equal(1);
        result.group.should.equal(16);
        result.id.should.equal(1);
      });
    });
  });
  it("should list users", function() {
    return test.load({
      Solutions: [
        {id: 1, exercise: 1, group: 1, results:{points: 4}, inProcess: false},
        {id: 2, exercise: 1, group: 1, results:{points: 12}, inProcess: false}
      ],
      Groups: [
        {id: 100, users: [1, 2], pendingUsers:[]},
        {id: 200, users: [3], pendingUsers:[]}
      ], Users: [
        {id: 1, pseudonym: "A", solutions: []},
        {id: 2, pseudonym: "B", solutions: [1]},
        {id: 3, pseudonym: "C", solutions: [1, 2]}
      ]
    }).then(function() {
      // i think the order is not guaranteed here, because of r.map
      return test.db.Manage.listUsers().then(function(users) {
        for (var i = 0; i != 3; ++i) {
          if (users[i].id == 1)
            users[i].totalPoints.should.equal(0);
          else if (users[i].id == 2)
            users[i].totalPoints.should.equal(4);
          else if (users[i].id == 3)
            users[i].totalPoints.should.equal(16);
        }
      });
    });
  });
});
