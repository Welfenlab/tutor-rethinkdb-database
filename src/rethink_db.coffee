connect = (rdb, host, port) ->
  rdb.connect {
    host: host,
    port: port
  }

ArrayQuery = (query, con, cb) ->
  con.use 'TutorDB'
  query.run(con, (err, cursor) ->
    if err
      cb err, null
    else
      cursor.toArray((err, results) ->
        cb err, results
      )
  )

ObjectQuery = (query, con, cb) ->
  con.use 'TutorDB'
  query.run(con, (err, singleResult) ->
    if err
      cb err, null
    else
      cb err, singleResult
  )

module.exports = (config) ->
  # All callbacks take 2 parameteres: error and data.
  # error comes from rethinkdb
  # data depends on the query / function that is called.
  DB:
    Exercises:
      name: 'Exercises'

      # Returns all exercises, no matter if active or not
      getAll: (cb) ->
        rdb = require 'rethinkdb'
        conProm = connect(rdb, config.database.host, config.database.port)

        query = rdb.table('Exercises')

        conProm.then((con) ->
          ArrayQuery(query, con, (err, data) ->
            con.close()
            cb(err, data)
          )
        )

      # Returns exercise by id, no matter if active or not
      getById: (id, cb) ->
        rdb = require 'rethinkdb'
        conProm = connect(rdb, config.database.host, config.database.port)

        query = rdb.table('Exercises').get(id)

        conProm.then((con) ->
          ObjectQuery(query, con, (err, data) ->
            con.close()
            cb(err, data)
          )
        )

      # Get all active exercises
      getAllActive: (cb) ->
        rdb = require 'rethinkdb'
        conProm = connect(rdb, config.database.host, config.database.port)

        query = rdb.table('Exercises').filter(
          rdb.row('activationDate').le(rdb.now())
        )

        conProm.then((con) ->
          ArrayQuery(query, con, (err, data) ->
            con.close()
            cb(err, data)
          )
        )

      getDetailedExercise : (id, cb) ->
        rdb = require 'rethinkdb'
        conProm = connect(rdb, config.database.host, config.database.port)

        conProm.then((con) ->
          query = rdb.table('Exercises').get(id)
          # get exercise
          ObjectQuery(query, con, (err, exercise) ->
            if err or not exercise?
              con.close()
              cb err, exercise
            else
              taskTable = rdb.table('Tasks')
              query = taskTable.getAll.apply(taskTable, exercise.tasks).coerceTo('array')
              ObjectQuery(query, con, (err, tasks) ->
                con.close()
                exercise.tasks = tasks;
                debugger;
                cb err, exercise
              )
          )
        )
