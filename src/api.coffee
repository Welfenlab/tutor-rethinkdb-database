module.exports = (con) ->
  Corrections: (require './corrections')(con)
  Exercises: (require './exercises')(con)
  Users: (require './users')(con)
  Groups: (require './groups')(con)
