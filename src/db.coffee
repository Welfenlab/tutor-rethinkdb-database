module.exports = (config) ->
  DB = (require './rethink_db')(config)
  # auto return
  Student: (require './student_queries')(DB)
