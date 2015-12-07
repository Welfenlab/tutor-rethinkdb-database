
_ = require 'lodash'
rdb = require 'rethinkdb'
moment = require 'moment'
utils = require './utils'


module.exports = (con,config) ->
  Group = (require './groups')(con, config)
  Exercises = (require './exercises')(con, config)
  Users = (require './users')(con, config)

  # For pdfs
  API =
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
      exercise.activationDate = rdb.ISO8601(exercise.activationDate)
      exercise.dueDate = rdb.ISO8601(exercise.dueDate)
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

    getStudentsSolutions: (user_id) ->
      (Group.getGroupForUser(user_id)).then (group) ->
        rdb.table("Solutions").getAll(group.id, {index: "group"}).coerceTo('array')
        .without("pdf").run(con)

    querySolutions: (solution_id) ->
      rdb.table("Solutions").filter( (s) ->
        s("id").match(solution_id)).without("pdf").limit(10).coerceTo('array').run(con)

    # Also stores the last sharejs data
    lockSpecificSolutionForPdfProcessor: (id) ->
      rdb.do(
        API.storeSolution(id),
        rdb.table("Solutions").get(id).update({"processingLock": true}, {returnChanges: true})
      )

    ############################################################################
    # Locks a single solution which is due.
    # Returns the locked solution, or undefined if none is available
    #
    # A solution sample must fulfill the following conditions, to be processable
    # - the exercise must be due
    # - it must not have benn processed so far
    # - it must not be in process (processingLock)
    ############################################################################
    lockSolutionForPdfProcessor: ->
      rdb.do(
        rdb
        .table("Solutions")
        .eqJoin("exercise", rdb.table("Exercises"))
        .filter((sol) ->
          # Is due, not processed so far and not in process?
          sol("right")("dueDate").lt(new Date()).and(
            sol("left")("processed").default(false).ne(true)
          ).and(
            sol("left")("processingLock").default(false).ne(true)
          )
        ).sample(1).nth(0).default(null), (solution) ->
          rdb.branch(
            rdb.expr(solution).ne(null),
            API.lockSpecificSolutionForPdfProcessor(solution("left")("id")).do(
              rdb.expr(solution)("left")
            ),
            rdb.expr(solution) # return null
          )
      ).run con

    resetPdfForSolution: (solutionId) ->
      rdb.table("Solutions").get(solutionId).run(con).then( (result) ->
        if !result?
          Promise.reject "No such solution."
        else
          rdb.table("Solutions").get(solutionId).replace( (solution) ->
            solution.without("processed").without("processingLock").without("pdf")
          ).run con
      )

    resetPdfForAllSolutions: () ->
      rdb.table("Solutions").replace((solution) ->
        solution.without("processed").without("processingLock").without("pdf")
      ).run con

    # Save the finished pdf file into the solution
    insertFinishedPdf: (solutionId, pdfData)->
      rdb.do(
        rdb.table("Solutions").get(solutionId).update(
          processed: true
          pdf: pdfData,
          pdfGenerationDate: rdb.now()
        ),
        rdb.table("Solutions").get(solutionId).replace((solution) ->
          solution.without("processingLock")
        )
      ).run con

    getTestsFromExercise: (exerciseId) ->
      rdb.table("Exercises").get(exerciseId)("tasks").pluck("number", "solutionTests", "tests")
      .coerceTo("array").run con

    pluckSolution: (solutionId, pluckArr) ->
      rdb.table("Solutions").get(solutionId).pluck(rdb.args(pluckArr)).run con

    # Store all solutions that are due and haven't been stored yet.
    storeAllFinalSolutions: () ->
      (rdb.table("Solutions").eqJoin("exercise", rdb.table("Exercises")).filter(
        # has not been stored before
        rdb.row("left")("finalSolutionStored")
        .default(false)
        .eq(false)
        .and(rdb.row("right")("dueDate").lt(rdb.now()))
      ).map ( (solution) ->
        solution.merge({
          finalSolutionStored: true,
          tasks: solution("right")("tasks").map( (task) ->
            rdb
            .db(config.sharejs.rethinkdb.db)
            .table(config.sharejs.tableName)
            .get(
              rdb.add(
                solution("left")("group").coerceTo("string"),
                ":",
                solution("left")("exercise").coerceTo("string"),
                ":",
                task("number").coerceTo("string")
              )
            )
          )
        })
      )).coerceTo("array").run con

    # Stores just one final solution, for load balancing
    storeFinalSolutionSample: () ->
      rdb.table("Solutions").eqJoin("exercise", rdb.table("Exercises")).filter(
        rdb.row("left")("finalSolutionStored")
        .default(false)
        .eq(false)
        .and(rdb.row("right")("dueDate").lt(rdb.now()))
      ).sample(1).map( (solution) ->
        solution.merge({
          finalSolutionStored: true,
          tasks: solution("right")("tasks").map( (task) ->
            rdb
            .db(config.sharejs.rethinkdb.db)
            .table(config.sharejs.tableName)
            .get(
              rdb.add(
                solution("left")("group").coerceTo("string"),
                ":",
                solution("left")("exercise").coerceTo("string"),
                ":",
                task("number").coerceTo("string")
              )
            )
          )
        })
      ).run con

    # Store just one solution, does not perform checkings and is meant to be used for admins.
    storeSolution: (sid) ->
      rdb.table("Solutions").eqJoin("exercise", rdb.table("Exercises"))
      .filter((solution) -> solution("left")("id").eq(sid))
      .map( (solution) ->
        solution.merge({
          #finalSolutionStored: rdb.table("Exercises").get(solution("right")("id")),
          finalSolutionStored: solution("right")("dueDate").lt(rdb.now()),
          tasks: solution("right")("tasks").map( (task) ->
            rdb
            .db(config.sharejs.rethinkdb.db)
            .table(config.sharejs.tableName)
            .get(
              rdb.add(
                solution("left")("group").coerceTo("string"),
                ":",
                solution("left")("exercise").coerceTo("string"),
                ":",
                task("number").coerceTo("string")
              )
            )
          )
        })
      ).coerceTo('array')

    ############################################################################
    # UpdateOldestSolution copies the sharejs data over into the solution table
    # for the solution that hasn't been updated the longest.
    #
    # In order to update this solution, the stored solution must not be final
    # and older than minAge seconds.
    ############################################################################
    updateOldestSolution: (minAge) ->
      minAge = minAge or 300
      if !config.sharejs?.rethinkdb?.db?
        return Promise.reject "No sharejs database defined"

      rdb.do(
        rdb.table("Solutions")
          .orderBy({index: "lastStore"})
          .filter(
            rdb.row("lastStore").add(minAge).lt(rdb.now()).and(
              rdb.row("finalSolutionStored").default(false).eq(false)
            )
          )
          .eqJoin('exercise', rdb.table("Exercises")).nth(0).default(null),
        (oldest) ->
          rdb.branch(
            rdb.expr(oldest).ne(null),
            rdb.table("Solutions").get(oldest("left")("id")).update({
              lastStore: rdb.now()
              finalSolutionStored: oldest("right")("dueDate").lt(rdb.now())
              tasks: oldest("right")("tasks").map( (task) ->
                # left = Solutions
                # right = Exercises
                # id = group : exercise : task("number")
                rdb.db(config.sharejs.rethinkdb.db)
                  .table(config.sharejs.tableName)
                  .get(
                    rdb.add(oldest("left")("group").coerceTo("string"),":",oldest("right")("id").coerceTo("string"),":",task("number").coerceTo("string"))
                  ).pluck("_data")
              ).map (s) ->
                s.merge({"solution": s("_data")}).without("_data")
              } , {nonAtomic: true}
            ),
            {} # noop
          )
      ).run con

      # old less robust and slower implementation, kept in case something was missed
      ###
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
              # id = group : exercise : task("number")
              rdb.db(config.sharejs.rethinkdb.db)
                .table(config.sharejs.tableName)
                .get(
                  rdb.add(oldest("left")("group").coerceTo("string"),":",oldest("right")("id").coerceTo("string"),":",task("number").coerceTo("string"))
                ).pluck("_data")
            ).map (s) ->
              s.merge({"solution": s("_data")}).without("_data")
            } , {nonAtomic: true})
          ).run(con)
      ###
