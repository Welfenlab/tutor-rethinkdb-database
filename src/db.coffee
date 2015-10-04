module.exports = (config) ->
  #DB = (require './rethink_db')(config)

  rdb = require 'rethinkdb'

  # auto return
  rdb.connect(config.database).then (con) ->
    con.use config.database.name

    (require './api')(con, config)
