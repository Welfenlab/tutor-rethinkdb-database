
_ = require 'lodash'
rdb = require 'rethinkdb'
moment = require 'moment'
utils = require './utils'


module.exports = (con,config) ->
  Group = (require './groups')(con, config)
  Exercises = (require './exercises')(con, config)
  Users = (require './users')(con, config)

  storeTutor: (tutor) ->
    if !tutor.name? or !tutor.password? or !tutor.contingent?
      Promise.reject("You must provide a name, password and contingent field")
    else if typeof tutor.contingent isnt "number"
      Promise.reject("The tutor contingent must be a number")
    else
      (rdb.table("Tutors").insert tutor, conflict: "update").run con

  get: ->
    utils.toArray(rdb.table('Exercises').run(con))

  getById: (id)->
    rdb.table('Exercises').get(id).run(con)

  storeExercise: (exercise) ->
    exercise.activationDate = exercise.activationDate
    exercise.dueDate = exercise.dueDate
    (rdb.table("Exercises").insert exercise, conflict: "update").run con

  listExercises: ->
    rdb.table("Exercises").coerceTo('array').run(con)

  # Lists users and the group. also adds their total points
  listUsers: ->
    rdb.table("Users").map( (user) ->
      user.merge(
        group: Group.getGroupForUserQuery(user("id"))
        totalPoints: Users.getTotalPointsQuery(user)
      )
    ).without("solutions").coerceTo('array').run(con)

  listTutors: ->
    utils.toArray rdb.table("Tutors").without("pw").run(con)

  listGroups: ->
    utils.toArray rdb.table("Groups").run(con)

  updateOldestSolution: (minAge) ->
    minAge = minAge or 300
    if !config.sharejs?.rethinkdb?.db?
      return Promise.reject "No sharejs database defined"
    rdb.do(
      rdb.table("Solutions")
        .orderBy({index: "lastStore"})
        .filter(rdb.row("lastStore").add(minAge).lt(rdb.now()))
        .eqJoin('exercise', rdb.table("Exercises")).nth(0),
      rdb.table("Solutions")
        .orderBy({index: "lastStore"})
        .filter(rdb.row("lastStore").add(minAge).lt(rdb.now()))
        .nth(0).update(lastStore: rdb.now()),
      (oldest, update) ->
        rdb.table("Solutions").get(oldest("left")("id")).update({
          tasks: oldest("right")("tasks").map( (task) ->
            # left = Solutions
            # right = Exercises
            # id = group : exercises : task("number")
            rdb.db(config.sharejs.rethinkdb.db)
              .table(config.sharejs.tableName)
              .get(
                rdb.add(oldest("left")("group").coerceTo("string"),":",oldest("right")("id").coerceTo("string"),":",task("number").coerceTo("string"))
              ).pluck("_data")
          ).map (s) ->
            s.merge({"solution": s("_data")}).without("_data")
          } , {nonAtomic: true})
        ).run(con)
