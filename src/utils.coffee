
_ = require 'lodash'
rdb = require 'rethinkdb'
rdbSetup = require 'rethinkdb-setup'

module.exports =
  toArray: (promise) ->
    promise.then (cursor) ->
      cursor.toArray()

  first: (promise) ->
    promise.then (cursor) ->
      cursor.next()

  checkError: (promise) ->
    promise.then (cursor) ->
      new Promise (resolve, reject) ->
        if cursor.errors > 0
          reject cursor.first_error
        resolve()

  nonEmpty: (promise) ->
    promise.then (cursor) ->
      new Promise (resolve) ->
        resolve cursor != null

  getFirstKey: (key, promise) ->
    promise.then (cursor) ->
      new Promise (resolve) ->
        resolve cursor[key]

  getAllKeys: (key, promise) ->
    promise.then (cursor) ->
      cursor.toArray().then (arr) ->
        _.map arr, (v) -> v[key]

  init: (con, config) ->
    config =
      db: config.db
      tables:
        Exercises: "id"
        Solutions: ["id","exercise","group"]
        Users: "id"
    new Promise (resolve, reject) ->
      rdbSetup.setup con, config, (err) ->
        if err
          reject (err)
        else
          resolve()

  load: (con, data) ->
    new Promise (resolve, reject) ->
      rdbSetup.load con, data, (err) ->
        if err
          reject (err)
        else
          resolve()
