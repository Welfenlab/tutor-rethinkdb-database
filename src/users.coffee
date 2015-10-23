
_ = require 'lodash'
rdb = require 'rethinkdb'
utils = require './utils'
rndString = require 'randomstring'
moment = require 'moment'


module.exports = (con, config) ->
  Groups = (require './groups')(con)

  config.lockTime = config.lockTime or 15
  clearPendingPseudonyms = ->
    rdb.table('PseudonymList').hasFields("locked").filter(
      rdb.now().sub(rdb.row("locked")).gt(config.lockTime*60)
    ).delete()

  generatePseudonymList = (p) ->
    [p].concat _.map (_.range 42), -> p + " " + _.random 1000,9999

  API =
    exists: (id) ->
      utils.nonEmpty rdb.table('Users').get(id).run(con)

    get: (id) ->
      rdb.table('Users').get(id).run(con)

    getPseudonym: (id) ->
      clearPendingPseudonyms()
      utils.getFirstKey "pseudonym", rdb.table('Users').get(id).pluck('pseudonym').run(con)

    setPseudonym: (id, newPseudonym) ->
      clearPendingPseudonyms()
      rdb.branch(rdb.table('PseudonymList').getAll(newPseudonym).filter( (doc) ->
          doc("user").ne(id)
        ).count().eq(0),
        rdb.table('Users').get(id).update(pseudonym: newPseudonym),
        rdb.error("Pseudonym #{newPseudonym} already taken")).run(con)

    getTotalPoints: (user_id) ->
      group = {}
      rdb.table("Groups").getAll(user_id, {index: "users"}).nth(0).run(con)
        .then (grp) ->
          API.get user_id
          group = grp
        .then (user) ->
          groups = user.previousGroups or []
          groups.push(group.id)
          console.log(groups)
          # rdb.table("Solutions").getAll(group.id, {index: "group"}).
          rdb.table("Solutions")
            .getAll(rdb.args(groups), {index: "group"})
            .filter(rdb.row("inProcess").eq(false))
            .getField("results")
            .getField("points")
            .sum()
            .default(0)
            .run(con)

    create: (user) ->
      if not user.id or not user.name or not user.pseudonym or not user.matrikel
        return Promise.reject "User information incomplete ("+JSON.stringify(user)+")"
      rdb.table('Users').insert(user,{conflict:"update"}).run(con).then ->
        API.lockRandomPseudonymFromList user.id, generatePseudonymList user.pseudonym
          .then (p) ->
              API.setPseudonym user.id, p
          .then -> Groups.hasGroup(user.id)
          .then (hasGroup) ->
            if !hasGroup
              return (Groups.create user.id, []).then (group) -> Promise.resolve()
            return Promise.resolve()

    lockRandomPseudonymFromList: (id, plist) ->
      clearPendingPseudonyms()
      utils.first(rdb.expr(plist)
        .filter((e) -> rdb.table("PseudonymList").getAll(e,index:"pseudonym").count().eq(0))
        .sample(1).run(con))
        .then (p) ->
          rdb.table("PseudonymList").insert(pseudonym: p, user: id, locked: rdb.ISO8601(moment().toJSON())).run(con)
            .then(-> return p)

    getInternalPseudonymList: ->
      clearPendingPseudonyms()
      utils.toArray rdb.table('PseudonymList').run(con)

    getPseudonymList: ->
      clearPendingPseudonyms()
      utils.toArray rdb.table('Users')('pseudonym').run(con)

    getTutor: (name) ->
      (rdb.table('Tutors').get(name).run(con)).then (tutor) ->
        if !tutor
          reject "Tutor #{name} does not exist"
          return
        else
          delete tutor.pw
          return tutor

    authTutor: (name, pw_compare) ->
      (rdb.table('Tutors').get(name).run(con)).then (tutor) ->
        if tutor
          return pw_compare tutor.password
        return false

    clearPendingPseudonyms: -> clearPendingPseudonyms().run(con)
