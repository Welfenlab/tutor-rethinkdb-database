
_ = require 'lodash'
rdb = require 'rethinkdb'
moment = require 'moment'
utils = require './utils'

# DB.Student.*

module.exports = (con) ->
  # Returns all exercises. Expired and active ones.
  get: ->
    utils.toArray(rdb.table('Exercises').filter( (ex) ->
      ex('activationDate').lt new Date() ).without(["tasks","solutions"]).run(con))

  getById: (id)->
    rdb.table('Exercises').get(id).without(["tasks","solutions"]).run(con).then (e) ->
      new Promise (resolve, reject) ->
        if (moment().isAfter e.activationDate)
          resolve e
        else
          reject "Exercise with id #{id} not found"

  getAllActive: ->
    utils.toArray(rdb.table('Exercises').filter( (ex) ->
      ex('activationDate').lt(new Date())
      .and(ex('dueDate').gt new Date()) ).without(["tasks","solutions"]).run(con))

  getDetailed: (id) ->
    rdb.table('Exercises').get(id).without("solutions").run(con).then (e) ->
      new Promise (resolve, reject) ->
        if (moment().isAfter e.activationDate)
          resolve e
        else
          reject "Exercise with id #{id} not found"
