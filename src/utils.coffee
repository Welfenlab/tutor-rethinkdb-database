
_ = require 'lodash'
rdb = require 'rethinkdb'
rdbSetup = require 'rethinkdb-setup'

tables =
  Exercises: "id"
  Solutions: ["id","exercise","group","lock"]
  Users: ["id","pseudonym", "previousGroup"]
  Groups: ["id", {name: "users", options: multi: true}, {name: "pendingUsers", options: multi: true} ]
  Tutors: "name"
  PseudonymList: ["pseudonym", "user"]

module.exports =
  toArray: (promise) ->
    promise.then (cursor) ->
      cursor.toArray()

  first: (promise) ->
    promise.then (cursor) ->
      cursor.next()

  firstOrEmpty: (promise) ->
    promise.then (cursor) ->
      cursor.toArray().then (arr) ->
        if arr.length == 0
          return null
        else
          return arr[0]

  firstAndCheck: (promise) ->
    promise.then (cursor) ->
      cursor.toArray().then (arr) ->
        new Promise (resolve, reject) ->
          if arr.length > 1
            reject "Expected exactly one result, but got more"
          else
            resolve arr[0]


  failIfNoUpdate: (promise, err) ->
    promise.then (cursor) ->
      new Promise (resolve, reject) ->
        if cursor.replaced == 0
          reject err
        else
          resolve()

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

  nonEmptyList: (promise) ->
    promise.then (cursor) ->
      cursor.toArray().then (arr) ->
        arr.length != 0

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
      tables: tables
    Promise.all [
      (new Promise (resolve, reject) ->
        rdbSetup.setup con, config, (err) ->
          if err
            resolve(err)
          else
            resolve()),
      (new Promise (resolve, reject) ->
        if !config.sharejs?.rethinkdb?.db
          resolve()
        config =
          db: config.sharejs.rethinkdb.db
        rdbSetup.setup con, config, (err) ->
          if err
            resolve(err)
          else
            resolve())
    ], (err1, err2) ->
      if err1 or err2
        return Promise.reject([err1, err2])

  empty: (con, config) ->
    config =
      db: config.db
      tables: tables
    new Promise (resolve, reject) ->
      rdbSetup.empty con, config, (err) ->
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
