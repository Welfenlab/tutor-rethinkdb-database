utils = require './utils'
rdb = require 'rethinkdb'

standardConfig =
  database:
    host : "localhost"
    port : 28015
    name : "TutorDB"

module.exports = (con, config) ->
  config = config or standardConfig
  conf = host:config.database.host, port:config.database.port, db: config.database.name

  Corrections: (require './corrections')(con,config)
  Exercises: (require './exercises')(con,config)
  Users: (require './users')(con,config)
  Groups: (require './groups')(con,config)
  Manage: (require './manage')(con,config)
  Utils:
    Empty: -> utils.empty con, conf # remove all data from all tables!!!!!!
    Init: ->
      rdb.dbCreate(conf.db).run(con).then ->
        utils.init con, conf   # initialize tables and indices
    Load: (data) -> utils.load con, data   # load data from json
