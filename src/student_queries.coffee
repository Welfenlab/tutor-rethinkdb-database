
_ = require 'lodash'
rdb = require 'rethinkdb'

# DB.Student.*

module.exports = (DB) ->
  # Returns all exercises. Expired and active ones.
  getExercises: (result) ->
    DB.DB.Exercises.getAll(result)

  # Returns a specific exercise by id
  getExerciseById: (id, result) ->
    DB.DB.Exercises.getById(id, result)

  # Returns all exercises which can still be edited
  # expirationDate > now()
  getAllActiveExercises: (result) ->
    DB.DB.Exercises.getAllActive(result)

  # Exercise containing the tasks
  getDetailedExercise: (id, result) ->
    DB.DB.Exercises.getDetailedExercise(id, result)
  
  # Total points for current user
  getTotalPoints: (user_id, result) ->
    #DB.DB.Exercises.getTotalPoints user_id, result
  
  # removes a user from a group.
  leaveGroup: (user_id, result) ->
    # get group
    # remove him from group
    # create copy of group with user
  
  # creates a group with specified users
  createGroup: (users_ids, result) ->
    # create groups with user_ids
  
  
