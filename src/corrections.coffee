
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

  hasResult = (doc) ->
    doc.hasFields("results")

  isFinalized = (doc) ->
    doc.hasFields("results").and(doc("inProcess").not())

  lockSolutionForTutor = (tutor, id) ->
    rdb.do(rdb.table("Solutions").get(id), (doc) ->
      rdb.branch(isFree(doc,tutor),
        rdb.table("Solutions").get(id).update(lock:tutor,inProcess:true),
        rdb.error "Solution (ID #{id}) is already locked"
    )).run(con)

  API =
    # returns for every active exercise how many are worked on / not corrected
    # and already corrected
    # [
    #  {exercise: 1, solutions: 100, corrected: 50, locked: 10}
    # ]
    getStatus: ->
      (Promise.all [
        (rdb.table("Solutions").group("exercise").count().run(con)),
        (rdb.table("Solutions").group("exercise").filter(isFinalized).count().run(con)),
        (rdb.table("Solutions").group("exercise").filter((doc) ->
          doc.hasFields("lock").and(doc("lock").ne(""))).count().run(con))
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

    getResultForExercise: (id) ->
      rdb.table("Solutions").get(id).run(con)

    setResultForExercise: (tutor, id, result) ->
      rdb.do(rdb.table("Solutions").get(id), (doc) ->
        rdb.branch(doc.hasFields("lock").and(doc("lock").eq(tutor)),
          rdb.table("Solutions").get(id).update({result: result}),
          rdb.error("Only locked solutions can be updated")
        )).run(con)

    finishSolution: (tutor, id) ->
      rdb.do(rdb.table("Solutions").get(id), (doc) ->
        rdb.branch(doc.hasFields("lock").and(doc("lock").eq(tutor).and(doc.hasFields("results"))),
          rdb.table("Solutions").get(id).update({inProcess:false}),
          rdb.error "Cannot finish solution, are you missing a result or are not authorized?"
          )).run(con)

    getSolutionsForExercise: (exercise_id) ->
      utils.toArray rdb.table("Solutions").getAll(exercise_id, {index: "exercise"}).without("results").run(con)

    getSolutionsForGroup: (group_id) ->
      utils.toArray rdb.table("Solutions").getAll(group_id, {index: "group"}).run(con)

    getLockedSolutionsForExercise: (exercise_id) ->
      utils.toArray rdb.table("Solutions")
        .getAll(exercise_id, index: "exercise")
        .filter (s) -> return s.hasFields('lock').and(s('lock').ne "")
        .without("results").run(con)

    getFinishedSolutionsForTutor: (tutor) ->
      utils.toArray rdb.table("Solutions").getAll("tutor", {index:"lock"}).filter((doc) ->
        doc("inProcess").not()).run(con)

    getUnfinishedSolutionsForTutor: (tutor) ->
      utils.toArray rdb.table("Solutions").getAll("tutor", {index:"lock"}).filter((doc) ->
        doc("inProcess")).run(con)

    lockNextSolutionForTutor: (tutor, exercise_id) ->
      (rdb.table("Solutions")
        .getAll(exercise_id, index: "exercise")
        .filter( (doc) -> isFree(doc)).sample(1).run(con)).then (sol) ->
          if !sol or sol.length != 1
            return Promise.reject "Already locked by another tutor"
          rdb.table("Solutions").get(sol[0].id).update({lock:tutor,inProcess:true}).run(con).then ->
            sol[0].inProcess = true
            sol[0].lock = tutor
            return sol[0]

    getNumPending: (exercise_id) ->
      rdb.table("Solutions").filter( (doc) ->
        doc.hasFields("results")).count().run(con)
