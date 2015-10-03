

_ = require 'lodash'
rdb = require 'rethinkdb'
moment = require 'moment'
utils = require './utils'

module.exports = (con) ->
  # destructive removale of user. Make sure to insert him into another group afterwards
  leaveGroup = (user_id) ->
    rdb.table("Groups").getAll(user_id, {index: "users"}).replace (doc) ->
      doc.merge users: doc("users").setDifference([user_id])

  Users = require('./users')(con)

  pseudonymListToIdList = (plist) ->
    rdb.expr(plist).map((p) -> rdb.table("Users").getAll(p,index:"pseudonym").nth(0)("id"))

  idListToPseudonymList = (idlist) ->
    idlist.map((id) -> rdb.table("Users").get(id)("pseudonym"))

  # remove sensitive infomation in group
  desensetizeGroup = (query) ->
    query.merge((g) ->
      users: idListToPseudonymList g("users")
      pendingUsers: idListToPseudonymList g("pendingUsers")).run(con)
  desensetizeGroups = (query) ->
    query.map((g) ->
      g.merge
        users: idListToPseudonymList g("users")
        pendingUsers: idListToPseudonymList g("pendingUsers")).run(con)

  # return
  create: (user_id, group_users) ->
    rdb.do(
      pseudonymListToIdList(group_users),
      leaveGroup(user_id),
      (grp_users, grp) ->
        rdb.table("Groups").insert users: [user_id], pendingUsers: grp_users.setDifference([user_id])
    ).run(con).then ->
      desensetizeGroup rdb.table("Groups").getAll(user_id, index:"users").nth(0)



  # get the Group of one user
  getGroupForUser: (user_id) ->
    desensetizeGroup rdb.table("Groups").getAll(user_id, {index: "users"}).nth(0)

    # returns a list of groups with pending invitations
  pending: (user_id) ->
    utils.toArray desensetizeGroups(rdb.table("Groups").getAll(user_id, {index: "pendingUsers"}))

  rejectInvitation: (user_id, group_id) ->
    (rdb.table("Groups").get(group_id).replace (doc) ->
      doc.merge pendingUsers: doc("pendingUsers").setDifference([user_id])).run(con)

  joinGroup: (user_id, group_id) ->
    (rdb.branch(
      rdb.table("Groups").get(group_id)("pendingUsers").contains(user_id),
      rdb.do(
        leaveGroup(user_id),
        rdb.table("Groups").get(group_id).replace((doc) ->
          doc.merge
            pendingUsers: doc("pendingUsers").setDifference([user_id]),
            users: doc("users").setUnion([user_id])),
        (res1,res2) -> res2),
      rdb.error "User cannot join a group without invitation")).run(con)
