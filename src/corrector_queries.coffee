
_ = require 'lodash'
rdb = require 'rethinkdb'

# DB.Corrector.*

module.exports = (DB) ->
  # Next Exercise for a tutor
  getNextExercise: (tutor_id, result) ->
    # query if tutor has exceeded necessary exercise pool
    # if yes and there are not finished exercises
    #    return remaining not finished exercise
    # if yes and there are no unfinished exercises
    #    return nothing
    # else return new exercise
  
  
  # get number of necessary corrections and already corrected ones and pending ones
  getCorrectionAssignmentData: (tutor_id, results) ->
    # query number of assigned corrections
    # query corrected exercises
    # query pending corrections
  
  listCorrection: (tutor_id, result) ->
    # return list of all corrections done by this tutor
  
  queryCorrectionByID: (id, num, result) ->
    # get a specific correction (exercise_num) for a student by LUH ID
  
  
