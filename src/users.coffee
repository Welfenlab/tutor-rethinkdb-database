
_ = require 'lodash'
rdb = require 'rethinkdb'
utils = require './utils'
rndString = require 'randomstring'


module.exports = (con) ->
  exists: (id) ->
    utils.nonEmpty rdb.table('Users').get(id).run(con)

  get: (id) ->
    rdb.table('Users').get(id).run(con)

  getPseudonym: (id) ->
    utils.getFirstKey "pseudonym", rdb.table('Users').get(id).pluck('pseudonym').run(con)

  setPseudonym: (id, newPseudonym) ->
    rdb.table('Users').get(id).update(pseudonym: newPseudonym).run(con)

  create: (id, matrikel, pseudonym) ->
    utils.checkError rdb.table('Users').insert({id:id, matrikel: matrikel, pseudonym: pseudonym},{conflict:"error"}).run(con)

  getPseudonymList: ->
    utils.getAllKeys "pseudonym", rdb.table('Users').get(id).pluck('pseudonym').run(con)

  getTutor: (name) ->
    (rdb.table('Tutors').get(name).run(con)).then (tutor) ->
      if !tutor
        reject "Tutor #{name} does not exist"
        return
      else
        delete tutor.pw
        return tutor

  authTutor: (name, pw_compare) ->
    (rdb.table('Tutors').get(name).run(con)).then (tutor) ->
      if tutor
        return pw_compare tutor.pw
      return false
