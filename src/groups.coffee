

_ = require 'lodash'
rdb = require 'rethinkdb'
moment = require 'moment'
utils = require './utils'

module.exports = (con) ->
  # destructive removale of user. Make sure to insert him into another group afterwards
  leaveGroup = (user_pseudo) ->
    rdb.table("Groups").getAll(user_pseudo, {index: "users"}).replace (doc) ->
      doc.merge users: doc("users").setDifference([user_pseudo])

  Users = require('./users')(con)

  # return
  create: (user_id, group_users) ->
    (Users.getPseudonym user_id).then (pseudonym) ->
      (leaveGroup pseudonym).run(con)
        .then ->
          pendingUsers = _.reject group_users, (pseudo) -> pseudo == pseudonym
          (rdb.table("Groups").insert users: [pseudonym], pendingUsers: pendingUsers).run(con)

  # get the Group of one user
  getGroupForUser: (user_id) ->
    utils.firstAndCheck (Users.getPseudonym user_id).then (pseudonym) ->
      rdb.table("Groups").getAll(pseudonym, {index: "users"}).run(con)

    # returns a list of groups with pending invitations
  pending: (user_id) ->
    utils.toArray (Users.getPseudonym user_id).then (pseudonym) ->
      rdb.table("Groups").getAll(pseudonym, {index: "pendingUsers"}).run(con)

  rejectInvitation: (user_id, group_id) ->
    (Users.getPseudonym user_id).then (pseudonym) ->
      (rdb.table("Groups").get(group_id).replace (doc) ->
        doc.merge pendingUsers: doc("pendingUsers").setDifference([pseudonym])).run(con)

  joinGroup: (user_id, group_id) ->
    (Users.getPseudonym user_id).then (pseudonym) ->
      (rdb.branch(
        rdb.table("Groups").get(group_id)("pendingUsers").contains(pseudonym),
        rdb.do(
          leaveGroup(pseudonym),
          rdb.table("Groups").get(group_id).replace((doc) ->
            doc.merge
              pendingUsers: doc("pendingUsers").setDifference([pseudonym]),
              users: doc("users").setUnion([pseudonym])),
          (res1,res2) -> res2),
        rdb.error "User cannot join a group without invitation")).run(con)
