_ = require 'lodash'
rdb = require 'rethinkdb'
moment = require 'moment'
utils = require './utils'

module.exports = (con, config) ->
  desensetizeGroupQuery = (query) ->
    query.merge((g) ->
      users: idListToPseudonymList g("users")
      pendingUsers: idListToPseudonymList g("pendingUsers"))

  # update user previousGroup field
  updatePreviousGroup = (user_id, get_group_query) ->
    # group_id
    rdb.branch(
      rdb.table("Users").get(user_id).hasFields("previousGroup").not(),
      rdb.table("Users").get(user_id).update(
        {"previousGroup": rdb.table("Groups")
                          .getAll(user_id, {index: "users"}).nth(0)("id").coerceTo('array')},
        {nonAtomic: true}
      ),
      rdb.table("Users").get(user_id).update(
        {"previousGroup": rdb.row("previousGroup").append(rdb.table("Groups")
                          .getAll(user_id, {index: "users"}).nth(0)("id"))},
        {nonAtomic: true}
      )
    )

  # removes user from group. terminally
  removeFromGroup = (user_id) ->
    rdb.table("Groups").getAll(user_id, {index: "users"}).replace (doc) ->
      doc.merge users: doc("users").setDifference([user_id])

  # get the Group of one user
  getGroupForUser = (user_id) ->
    desensetizeGroupQuery rdb.table("Groups").getAll(user_id, {index: "users"}).nth(0)

  # destructive removale of user. Make sure to insert him into another group afterwards
  leaveGroup = (user_id) ->
    rdb.do(
      updatePreviousGroup(user_id, getGroupForUser),
      removeFromGroup(user_id),
      (updateStats, replaceStats) ->
        updateStats: updateStats,
        replaceStats: replaceStats
    )

  pseudonymListToIdList = (plist) ->
    rdb.expr(plist).map((p) -> rdb.table("Users").getAll(p,index:"pseudonym").nth(0)("id"))

  idListToPseudonymList = (idlist) ->
    idlist.map((id) -> rdb.table("Users").get(id)("pseudonym"))

  # remove sensitive infomation in group
  desensetizeGroup = (query) ->
    desensetizeGroupQuery(query).run(con)

  desensetizeGroups = (query) ->
    query.map((g) ->
      g.merge
        users: idListToPseudonymList g("users")
        pendingUsers: idListToPseudonymList g("pendingUsers")).run(con)

  createGroup = (user_id, group_users) ->
    rdb.do(
      pseudonymListToIdList(group_users),
      leaveGroup(user_id),
      (grp_users, grp) ->
        rdb.table("Groups").insert users: [user_id], pendingUsers: grp_users.setDifference([user_id])
    ).run(con).then (res) ->
      desensetizeGroup rdb.table("Groups").getAll(user_id, index:"users").nth(0)

  removePendingUsers = (group_id) ->
    rdb.table("Groups").get(group_id).update({pendingUsers: []})

  # return
  create: (user_id, group_users) -> createGroup(user_id, group_users)

  hasGroup: (user_id) ->
    rdb.table("Groups").getAll(user_id, {index: "users"}).count().run(con).then (cnt) ->
      return cnt != 0

  # get the Group of one user
  getGroupForUser: (user_id) -> getGroupForUser(user_id).run(con)

  # Does not desensetize in contrary to getGroupForUser
  getGroupForUserUnfiltered: (user_id) ->
    rdb.table("Groups").getAll(user_id, {index: "users"}).nth(0).run(con)

  getGroupForUserQuery: (user_id) -> getGroupForUser(user_id)

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

  getGroups: () ->
    rdb.table("Groups").coerceTo('array').run(con)

  getGroup: (group_id) ->
    rdb.table("Groups").get(group_id).run(con)

  # Never use!
  leaveGroupOnly: (user_id) -> leaveGroup(user_id).run(con)

  leaveGroup: (user_id) ->
    (require './users')(con, config).getPseudonym(user_id).then (pseudo) ->
      getGroupForUser(user_id).run(con).then (group) ->
        if group.users.length == 1
          removePendingUsers(group.id).run(con).then () ->
            return
        createGroup(user_id, [pseudo])
