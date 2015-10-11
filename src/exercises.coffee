
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
      rdb.table('Exercises').filter( (ex) -> ex('activationDate').lt new Date() )
        .coerceTo('array').run(con).then (e) ->
          new Promise (resolve, reject) ->
            _.forEach e, (n, k) ->
              e[k].tasks = _.map n.tasks, (n) ->
                delete n.solution
                delete n.solutionTest
                n
            resolve e

    getById: (id)->
      rdb.table('Exercises').get(id).run(con).then (e) ->
        new Promise (resolve, reject) ->
          if (moment().isAfter e.activationDate)
            e.tasks = _.map e.tasks, (n) ->
              delete n.solution
              delete n.solutionTest
              n
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

    createExerciseSolution: (user_id, exercise_id) ->
      (API.isActive exercise_id).then (active) ->
        if !active
          Promise.reject "Cannot change solution for an exercise that is not active (user #{user_id}, execise: #{exercise_id})"
        else
          (Group.getGroupForUser(user_id)).then (group) ->
            rdb.branch(
              rdb.table("Solutions").getAll(group.id,{index:"group"})
                .filter({"exercise":exercise_id}).count().eq(0),
              rdb.table("Solutions").insert
                group: group.id
                exercise: exercise_id
                tasks: []
                lastStore: rdb.epochTime(0)
              rdb.expr("Solution already exists")
              ).run(con)
