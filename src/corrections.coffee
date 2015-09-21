
_ = require 'lodash'
moment = require 'moment'
utils = require './utils'
rdb = require 'rethinkdb'


module.exports = (con) ->
  isFree = (doc,tutor) ->
    if tutor
      doc.hasFields("results").not().and(
        doc.hasFields("lock").not().or(doc("lock").eq(tutor).or(doc("lock").eq(""))))
    else
      doc.hasFields("results").not().and(
        doc.hasFields("lock").not().or(doc("lock").eq("")))

  API =
    # returns for every active exercise how many are worked on / not corrected
    # and already corrected
    # [
    #  {exercise: 1, solutions: 100, corrected: 50, locked: 10}
    # ]
    getStatus: ->
      (Promise.all [
        (rdb.table("Solutions").group("exercise").count().run(con)),
        (rdb.table("Solutions").group("exercise").filter((doc) ->
          doc.hasFields("results")).count().run(con)),
        (rdb.table("Solutions").group("exercise").filter((doc) ->
          doc.hasFields("results").not().and(
            doc.hasFields("lock").and(doc("lock").ne("")))).count().run(con))
      ]).then (values) ->
        exerciseMap = {}
        _.each values[0], (v) ->
          exerciseMap[v.group] =
            exercise: v.group
            solutions: v.reduction
            corrected: 0
            locked: 0
        _.each values[1], (v) ->
          exerciseMap[v.group].corrected = v.reduction
        _.each values[2], (v) ->
          exerciseMap[v.group].locked = v.reduction
        return  _.values(exerciseMap)

    # get locked exercise for tutor

    # get the list of all results for an exercise
    getResultsForExercise: (exercise_id) ->
      utils.toArray rdb.table("Solutions").getAll(exercise_id, {index: "exercise"}).run(con)

    getSolutionsForExercise: (exercise_id) ->
      utils.toArray rdb.table("Solutions").getAll(exercise_id, {index: "exercise"}).without("results").run(con)

    getSolutionsForGroup: (group_id) ->
      utils.toArray rdb.table("Solutions").getAll(group_id, {index: "group"}).run(con)

    getLockedSolutionsForExercise: (exercise_id) ->
      utils.toArray rdb.table("Solutions")
        .getAll(exercise_id, index: "exercise")
        .filter (s) -> return s('lock').ne ""
        .without("results").run(con)

    lockSolutionForTutor: (id, tutor) ->
      rdb.do(rdb.table("Solutions").get(id), (doc) ->
        rdb.branch(isFree(doc,tutor),
          rdb.table("Solutions").get(id).update(lock:tutor),
          rdb.error "Solution (ID #{id}) is already locked"
      )).run(con)

    lockNextSolutionForTutor: (exercise_id, tutor) ->
      utils.failIfNoUpdate(rdb.table("Solutions")
        .getAll(exercise_id, index: "exercise")
        .filter( (doc) ->
          isFree(doc)).sample(1).update({lock:tutor}).run(con))

    getNumPending: (exercise_id) ->
      rdb.table("Solutions").filter( (doc) ->
        doc.hasFields("results")).count().run(con)
