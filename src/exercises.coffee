
_ = require 'lodash'
rdb = require 'rethinkdb'
moment = require 'moment'
utils = require './utils'

# DB.Student.*

module.exports = (con) ->
  # Returns all exercises. Expired and active ones.
  Group = (require './groups')(con)

  API =
    get: ->
      utils.toArray(rdb.table('Exercises').filter( (ex) ->
        ex('activationDate').lt new Date() ).without("solutions").run(con))

    getById: (id)->
      rdb.table('Exercises').get(id).without("solutions").run(con).then (e) ->
        new Promise (resolve, reject) ->
          if (moment().isAfter e.activationDate)
            resolve e
          else
            reject "Exercise with id #{id} not found"

    getAllActive: ->
      utils.toArray(rdb.table('Exercises').filter( (ex) ->
        ex('activationDate').lt(new Date())
        .and(ex('dueDate').gt new Date()) ).without("solutions").run(con))

    isActive: (id) ->
      utils.nonEmptyList(rdb.table("Exercises").getAll(id).filter( (ex) ->
        ex('activationDate').lt(new Date())
        .and(ex('dueDate').gt new Date())).run(con))

    getExerciseSolution: (user_id, exercise_id) ->
      (Group.getGroupForUser(user_id)).then (group) ->
        utils.firstOrEmpty(rdb.table("Solutions").getAll(group.id, index:"group")
          .filter( (doc) -> doc("exercise").eq(exercise_id)).run(con)).then (sol) ->
            if !sol
              return null
            if sol.inProcess
              delete sol.lock
              delete sol.results
            delete sol.inProcess
            return sol

    setExerciseSolution: (user_id, exercise_id, solution) ->
      (API.isActive exercise_id).then (active) ->
        if !active
          Promise.reject "Cannot change solution for an exercise that is not active (user #{user_id}, execise: #{exercise_id})"
        else
          (API.getExerciseSolution user_id, exercise_id).then (sol) ->
            if sol
              (rdb.table("Solutions").get(sol.id).update solution: solution).run(con)
            else
              (Group.getGroupForUser(user_id)).then (group) ->
                (rdb.table("Solutions").insert group: group.id, exercise: exercise_id, solution: solution).run(con)
