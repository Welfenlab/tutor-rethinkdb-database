
_ = require 'lodash'
rdb = require 'rethinkdb'
moment = require 'moment'
utils = require './utils'

# DB.Student.*

module.exports = (con, config) ->
  # Returns all exercises. Expired and active ones.
  Group = (require './groups')(con, config)
  Corrections = (require './corrections')(con, config)

  getGroupSolutionForExercise = (group_id, exercise_id) ->
    rdb.table("Solutions").getAll(group_id, {index: "group"}).filter({"exercise": exercise_id}).nth(0).default(null)

  # Find solution id in user.solution for exercise_id, if existant
  findSolutionForExerciseInUserArray = (user_id, exercise_id) ->
    rdb.branch(
      rdb.table("Users").get(user_id)("solutions").count().ne(0),
      rdb.table("Solutions").getAll(
        rdb.args(rdb.table("Users").get(user_id)("solutions"))
      ).filter({"exercise": exercise_id}).nth(0).default(null),
      rdb.expr(null)
    )

  getExerciseSolution = (user_id, exercise_id) ->
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

  # param group_id: the users Group
  # param user_id: the user
  # param solution_id: the user solution for the exercise
  # param exercise_id: the exercise we want to create a solution for
  createAndReplaceSolutionForUser = (group_id, user_id, solution_id, exercise_id) ->
    ###
    if group has solution for exercise
      remove old solution from user
      assign group solution to user
    else
      copy solution of user to group
    ###

    rdb.branch(
      rdb.table("Solutions").getAll(group_id, {index: "group"}).count().ne(0),
      # The group has a solution already
      # -> delete the solution in the users solution array! -> POTENTIAL LOSS OF POINTS -> WARN USER
      rdb.do(getGroupSolutionForExercise(group_id, exercise_id), (newSolution) ->
        rdb.do(rdb.table("Users").get(user_id).update(
            {solutions: rdb.table("Users").get(user_id)("solutions").difference [solution_id]}, nonAtomic: true
          ), () ->
          rdb.table("Users").get(user_id).update(() ->
            solutions: rdb.table("Users").get(user_id)("solutions").append(newSolution("id"))
          , nonAtomic: true)
        )
      )
      # Else set the groups solution to the users solution
      rdb.table("Solutions").insert(
        group: group_id
        exercise: exercise_id
        tasks: rdb.table("Solutions").get(solution_id).getField("tasks")
        lastStore: rdb.epochTime(0) # There hasn't been any stores
      )
    )

  createGroupSolutionAndUpdateUser = (group_id, exercise_id, groupSolution, user_id) ->
    if groupSolution?
      # The group has a solution already
      # Assign solution id of group to user
      rdb.table("Users").get(user_id).update(
        solutions: rdb.row("solutions").append(groupSolution.id)
      ).run(con)
    else
      # There is no group solution and no user Solution
      rdb.table("Solutions").insert({
        group: group_id
        exercise: exercise_id
        tasks: []
        lastStore: rdb.epochTime(0) # There hasn't been any stores
      }, {return_changes: true}).run(con).then (changes) ->
        rdb.table("Users").get(user_id).update(
          solutions: rdb.row("solutions").append(changes.generated_keys[0])
        ).run(con)

  API =
    get: ->
      rdb.table('Exercises').filter( (ex) -> ex('activationDate').lt new Date() )
        .coerceTo('array').run(con).then (e) ->
          new Promise (resolve, reject) ->
            _.forEach e, (n, k) ->
              e[k].tasks = _.map n.tasks, (n) ->
                delete n.solution
                delete n.solutionTest
                delete n.internals
                n
            resolve e

    getById: (id)->
      rdb.table('Exercises').get(id).run(con).then (e) ->
        new Promise (resolve, reject) ->
          if (moment().isAfter e.activationDate)
            e.tasks = _.map e.tasks, (n) ->
              delete n.solution
              delete n.solutionTest
              delete n.internals
              n
            resolve e
          else
            reject "Exercise with id #{id} not found"

    getAllActive: ->
      utils.toArray(rdb.table('Exercises').filter( (ex) ->
        ex('activationDate').lt(new Date())
        .and(ex('dueDate').gt new Date()) ).without("solutions").without('solutionTest').without('internals').run(con))
    
    isActive: (id) ->
      utils.nonEmptyList(rdb.table("Exercises").getAll(id).filter( (ex) ->
        ex('activationDate').lt(new Date())
        .and(ex('dueDate').gt new Date())).run(con))

    getExerciseSolution: (user_id, exercise_id) ->
      getExerciseSolution(user_id, exercise_id)

    # createExerciseSolution is called whenever a user is opening an exercise.
    # If no solution for his group exists, it will be created and all associated users
    # get their solutions array updated with the freshly created solution id.
    # If there is a solution in the users array that is associated with the exercise_id
    # but not corresponding to the users group, it will be removed from this Users
    # solution list, except there is no solution for this group, it will then be copied over.
    createExerciseSolution: (user_id, exercise_id) ->
      # isActive tests both things: whether the exercise is active and not expired
      return (API.isActive exercise_id).then (active) ->
        if !active
          return Promise.reject "Cannot change solution for an exercise that is not active (user #{user_id}, exercise: #{exercise_id})"
        else
          # console.log("get group")
          return Group.getGroupForUserUnfiltered(user_id).then (group) ->
            # Find solution id in user.solution for exercise_id, if existant
            return findSolutionForExerciseInUserArray(user_id, exercise_id).run(con).then (solution) ->
              return getGroupSolutionForExercise(group.id, exercise_id).run(con).then (groupSolution) ->
                if solution?
                  # There is a solution for this exercise in the user array
                  # Is this exercise the exercise of the group?
                  return rdb.branch(
                    rdb.table("Solutions").getAll(rdb.args(rdb.table("Users").get(user_id).getField("solutions"))).filter({
                      "exercise": exercise_id
                      "group_id": group.id
                    }).count().ne(0),
                    # It is the exercise of the group
                    rdb.expr("Solution already exists"),
                    # It is not the solution of the group!
                    # Does the group have a solution?
                    createAndReplaceSolutionForUser(group.id, user_id, solution.id, exercise_id)
                  ).run(con)
                else
                  # Does the group have a solution?
                  return createGroupSolutionAndUpdateUser(group.id, exercise_id, groupSolution, user_id)
      # END_FUNCTION

    getSolutions: () ->
      rdb.table("Solutions").coerceTo('array').run(con)
