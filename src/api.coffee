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

  Connection: con
  Corrections: (require './corrections')(con,config)
  Exercises: (require './exercises')(con,config)
  Users: (require './users')(con,config)
  Groups: (require './groups')(con,config)
  Manage: (require './manage')(con,config)
  Rethinkdb: rdb
  Utils:
    Empty: -> utils.empty con, conf # remove all data from all tables!!!!!!
    Init: ->
      (new Promise (resolve) ->
        rdb.dbCreate(conf.db).run(con).then(resolve).catch(resolve)
        return)
      .then new Promise (resolve) ->
        if !config.sharejs?.rethinkdb?.db?
          resolve()
        else
          rdb.dbCreate(config.sharejs.rethinkdb.db).run(con).then(resolve).catch(resolve)
        return
      .then ->
        utils.init con, conf   # initialize tables and indices
    Load: (data) -> utils.load con, data   # load data from json
