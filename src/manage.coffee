
_ = require 'lodash'
rdb = require 'rethinkdb'
moment = require 'moment'
utils = require './utils'


module.exports = (con) ->

  storeTutor: (name, pw_hash) ->
    (rdb.table("Tutors").insert {name: name, pw:pw_hash}, conflict: "update").run con

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
