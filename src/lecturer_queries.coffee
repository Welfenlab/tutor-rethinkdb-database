
_ = require 'lodash'
rdb = require 'rethinkdb'

# DB.Lecturer.*

module.exports = (DB) ->
  # create Tutor
  ### 
  {
    name: "Maximilian Klein",
    contingent: 10,
    password: "abcTest123"
  }
  ###
  createTutor: (tutor, result) ->
    # insert tutor user
  
  # sets a tutor
  setTutor: (tutor, result) ->
    # put the tutor information into the database
  
  # creates an empty exercise prototype
  createProtoExercise: (result) ->
    # inserts a new empty exercise
  
  
  # stores an exercise prototype
  setProtoExercise: (exercise, result) ->
    # changes the proto exercise
  
  # publish the current version of the exercise
  publishExercise: (exercise, result) ->
    # takes the currently stored exercise with the given ID (exercise.id) and 
    # publishes it as a "real" exercise that students can edit
    # if the exercise already exists it gets overwritten
  
  # return a list of students with additional infos
  listStudents: (result) ->
    # list all students with their points
