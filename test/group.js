
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

describe("Group queries", function(){
  var test = {db:null,cleanup:null,load:null};
  // setup a new fresh database for every test!
  beforeEach(testUtils.beforeTest(test));
  // remove the DB after each test
  afterEach(testUtils.afterTest(test));


  it("should return the group for a user", function(){
    return test.load({Groups:[
      {id:1,users:[1,5],pendingUsers:[]},
      {id:2,users:[2,3],pendingUsers:[]},
      {id:3,users:[4],pendingUsers:[]}
    ], Users:[{id:1,pseudonym:"A"},{id:2,pseudonym:"B"},
      {id:3,pseudonym:"C"},{id:4,pseudonym:"D"},{id:5,pseudonym:"E"}]})
    .then(function(){
      return test.db.Groups.getGroupForUser(1).then(function(group){
        group.id.should.equal(1);
      });
    });
  });
  /*
  it("should return an error if the user is in multiple groups", function(){
    return test.load({Groups:[
      {id:2,users:[1,2]},
      {id:1,users:[1,5]},
      {id:3,users:[4]}
    ], Users:[{id:1,pseudonym:1}]})
    .then(function(){
      return test.db.Groups.getGroupForUser(1).should.be.rejected;
    });
  });
*/
  it("should be possible to create a group of users", function(){
    return test.load({Users:[
      {id:1,pseudonym:"A"},
      {id:2,pseudonym:"B"},
      {id:3,pseudonym:"C"}
    ]})
    .then(function(){
      return test.db.Groups.create(1,["A","B","C"]).then(function(group){
        group.users.should.deep.equal(["A"]);
      });
    });
  });
  it("creating a group of users should add others as pending", function(){
    return test.load({Users:[
      {id:1,pseudonym:"A"},
      {id:2,pseudonym:"B"},
      {id:3,pseudonym:"C"}
    ]})
    .then(function(){
      return test.db.Groups.create(1,["A","B","C"]).then(function(group){
        group.should.have.property("pendingUsers");
        group.pendingUsers.should.include.members(["B","C"]);
      });
    });
  });
  it("should return all pending group invitations", function(){
    return test.load({Groups:[{id:1,users:[1],pendingUsers:[2,3]},
                      {id:2,users:[4],pendingUsers:[2,3]},
                      {id:3,users:[7],pendingUsers:[1,3]}],
              Users: [{id:1,pseudonym:"A"},{id:2,pseudonym:"B"},
                {id:3,pseudonym:"C"},{id:4,pseudonym:"D"},{id:7,pseudonym:"G"}]})
    .then(function(){
      return test.db.Groups.pending(2).then(function(pending){
        pending.should.have.length(2);
        pending.should.deep.include.members([{id:1,users:["A"],pendingUsers:["B","C"]},
                                            {id:2,users:["D"],pendingUsers:["B","C"]}]);
      });
    });
  });
  it("should be able to join a group with an invitation", function(){
    return test.load({Groups:[{id:1,users:[1],pendingUsers:[2,3]},
                      {id:2,users:[4],pendingUsers:[2,3]},
                      {id:3,users:[7,2],pendingUsers:[1,3]}],
              Users: [{id:1,pseudonym:"A"},{id:2,pseudonym:"B"},
                {id:3,pseudonym:"C"},{id:4,pseudonym:"D"},{id:7,pseudonym:"G"}]})
    .then(function(){
      return test.db.Groups.joinGroup(2, 2).then(function(){
        return test.db.Groups.getGroupForUser(2).then(function(group){
          group.id.should.equal(2);
        })
      });
    });
  });
  it("should not be possible to join a group without an invitation", function(){
    return test.load({Groups:[{id:1,users:[1],pendingUsers:[2,3]},
                      {id:2,users:[4],pendingUsers:[2,3]},
                      {id:3,users:[7],pendingUsers:[1,3]}],
              Users: [{id:1,pseudonym:"A"},{id:2,pseudonym:"B"},
                {id:3,pseudonym:"C"},{id:4,pseudonym:"D"},{id:7,pseudonym:"G"}]})
    .then(function(){
      return test.db.Groups.joinGroup(2, 3).should.be.rejected;
    });
  });
  it("should not be possible to join a non existing group", function(){
    return test.load({Groups:[{id:1,users:[1],pendingUsers:[2,3]},
                      {id:2,users:[4],pendingUsers:[2,3]},
                      {id:3,users:[7],pendingUsers:[1,3]}],
              Users: [{id:1,pseudonym:"A"},{id:2,pseudonym:"B"},
                {id:3,pseudonym:"C"},{id:4,pseudonym:"D"},{id:7,pseudonym:"G"}]})
    .then(function(){
      return test.db.Groups.joinGroup(2, 151).should.be.rejected;
    });
  });
  it("should be able to reject a group invitation", function(){
    return test.load({Groups:[{id:1,users:[1],pendingUsers:[2,3]},
                      {id:2,users:[4],pendingUsers:[2,3]},
                      {id:3,users:[7],pendingUsers:[1,3]}],
              Users: [{id:1,pseudonym:"A"},{id:2,pseudonym:"B"},
                {id:3,pseudonym:"C"},{id:4,pseudonym:"D"},{id:7,pseudonym:"G"}]})
    .then(function(){
      return test.db.Groups.rejectInvitation(2, 2).then(function(){
        return test.db.Groups.pending(2).then(function(groups){
          groups.should.have.length(1);
        });
      });
    });
  });
  it("should be possible to leave a group", function() {
    return test.load({Groups:[{id:1,users:[1],pendingUsers:[2,3]},
                      {id:2,users:[4],pendingUsers:[2,3]},
                      {id:3,users:[7],pendingUsers:[1,3]}],
              Users: [{id:1,pseudonym:"A", previousGroup:[]},{id:2,pseudonym:"B"},
                {id:3,pseudonym:"C"},{id:4,pseudonym:"D"},{id:7,pseudonym:"G"}]})
    .then(function(){
      // should be?:
      // return test.db.Groups.getGroupForUser(1).should.be.rejected;
      return test.db.Groups.leaveGroup(1).then(function() {
        return test.db.Groups.hasGroup(1).then(function(hasGroup) {
          hasGroup.should.equal(false);
          return test.db.Users.get(1).then(function(user) {
            user.previousGroup.should.contain(1);
          })
          return test.db.Users.leaveGroup(4).then(function() {
            return test.db.Users.get(4).then(function(user) {
              user.previousGroup.should.contain(4);
            })
          });
        });
      });
    });
  });
  /**/
});
