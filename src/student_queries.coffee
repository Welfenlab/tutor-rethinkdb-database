
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

  getAllActiveExercises: (result) ->
    DB.DB.Exercises.getAllActive(result)

  getDetailedExercise: (id, result) ->
    DB.DB.Exercises.getDetailedExercise(id, result)
