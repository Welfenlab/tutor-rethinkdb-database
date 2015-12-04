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

describe("Job Queries", function() {
  var test = {db:null,cleanup:null,load:null};
  // setup a new fresh database for every test!
  beforeEach(testUtils.beforeTest(test));
  // remove the DB after each test
  afterEach(testUtils.afterTest(test));

  it("should add a new job", function() {
    return test.load({
      Jobs: [
        {id: 0, name: "printJob", type:"recurring", data: {seconds: 5}}
      ]
    }).then(function() {
      return test.db.Jobs.addJob("Hello", "recurring", {seconds: 3}).then(function() {
        test.db.Jobs.getAllJobs().then(function(jobs) {
          jobs.should.have.length(2);
        });
      });
    });
  });
  it("should remove a job", function() {
    return test.load({
      Jobs: [
        {id: 0, name: "printJob", type:"recurring", data: {seconds: 5}},
        {id: 1, name: "helloPeopleJob", type:"cron", data: "* 1 * * * *"}
      ]
    }).then(function() {
      return test.db.Jobs.removeJob(1).then(function() {
        test.db.Jobs.getAllJobs().then(function(jobs) {
          jobs.should.have.length(1);
        });
      });
    });
  });
  it("should get a job", function() {
    return test.load({
      Jobs: [
        {id: 0, name: "printJob", type:"cron", data: "* 1 * * * *"}
      ]
    }).then(function() {
      return test.db.Jobs.getJob(0).then(function(job) {
        job.name.should.equal("printJob");
        job.type.should.equal("cron");
        job.data.should.equal("* 1 * * * *");
      });
    });
  });
  it("should get all jobs", function() {
    return test.load({
      Jobs: [
        {id: 0, name: "A", type:"TA", data: "DA"},
        {id: 1, name: "B", type:"TB", data: "DB"}
      ]
    }).then(function() {
      return test.db.Jobs.getAllJobs().then(function(jobs) {
        jobs.should.have.length(2);
        jobs[0].name.should.equal("A");
        jobs[0].type.should.equal("TA");
        jobs[0].data.should.equal("DA");
        jobs[1].name.should.equal("B");
        jobs[1].type.should.equal("TB");
        jobs[1].data.should.equal("DB");
      });
    });
  });
});
