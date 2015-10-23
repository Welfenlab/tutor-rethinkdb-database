
_ = require 'lodash'
rdb = require 'rethinkdb'
moment = require 'moment'
utils = require './utils'


module.exports = (con,config) ->

  storeTutor: (tutor) ->
    (rdb.table("Tutors").insert tutor, conflict: "update").run con

  get: ->
    utils.toArray(rdb.table('Exercises').run(con))

  getById: (id)->
    rdb.table('Exercises').get(id).run(con)

  storeExercise: (exercise) ->
    exercise.activationDate = rdb.ISO8601(exercise.activationDate)
    exercise.dueDate = rdb.ISO8601(exercise.dueDate)
    (rdb.table("Exercises").insert exercise, conflict: "update").run con

  listExercises: ->
    utils.toArray rdb.table("Exercises").run(con)

  listUsers: ->
    utils.toArray rdb.table("Users").run(con)

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
          tasks: oldest("right")("tasks").map( (t) ->
            rdb.db(config.sharejs.rethinkdb.db)
              .table(rdb.add(rdb.args(oldest("left")("group").split("-"))))
              .get(
                rdb.add(rdb.args(rdb.add(oldest("right")("id"),t("number")).split("-")))
              ).pluck("_data")
          ).map (s) ->
            s.merge({"solution": s("_data")}).without("_data")
          } , {nonAtomic: true})
        ).run(con)
