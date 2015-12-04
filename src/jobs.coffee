_ = require 'lodash'
rdb = require 'rethinkdb'
moment = require 'moment'
utils = require './utils'

module.exports = (con, config) ->

  # API
  addJob: (name, type, data) ->
    rdb.table("Jobs").insert(
      name: name
      type: type
      data: data
    ).run con

  getJob: (id) ->
    rdb.table("Jobs").get(id).run con

  setJob: (id, name, type, data) ->
    rdb.table("Jobs").get(id).update(
      name: name
      type: type
      data: data
    ).run con

  removeJob: (id) ->
    rdb.table("Jobs").get(id).delete().run con

  getAllJobs: ->
    rdb.table("Jobs").coerceTo('array').run con
