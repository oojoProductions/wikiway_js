###
wikiway
Authors: Andrin Schnegg (andrin[at]schnegg.biz),
         Sebastian Widmer (widmer.sebastian[at]gmail.com)
Version: Experimental
Date:    25.05.2013
###

class GameController
	CACHE_TIME = 5*60*1000
	games = []
	request = require 'request'
	cache = require 'memory-cache'
	cheerio = require 'cheerio'
	tools = require '../helpers/tools.js'
	l = require '../helpers/log.js'
	Game = require('../models/game').Game
	UserSaveGame = require('../models/user_save_game').UserSaveGame

	constructor: (server) ->
		@dummyData()
		@server = server

	dummyData: ->
		games.push new Game 'Coop', 'Migros', @
		games.push new Game 'Aldi', 'Lidl', @

	newGame: (startArticle, endArticle, client, callback) ->
		client.leave 'listGames'
		unless startArticle? and endArticle? and startArticle isnt "" and endArticle isnt ""
			return callback(false)
		#load head to check if article exists
		req_options =
			uri: 'http://de.wikipedia.org/wiki/'+tools.uriEncode startArticle
			method: 'HEAD'
			headers: 'User-Agent': 'wikiway_js'
		await request req_options, defer(error, response, body)
		if response.statusCode == 200 # ok
			await @getWikiContent tools.uriEncode(endArticle), defer(bodycontent, links, title)
			if title?
				games.push new Game startArticle, title, @
				callback true
			else
				l.log "game - endarticle (#{endArticle}) not found", l.WARN
				callback false				

	joinGame: (client, gameId, callback) ->
		if games[gameId]? 
			client.get 'username', (err, data) ->
				games[gameId].clients.push data
			++games[gameId].clientCount
			userSaveGame = new UserSaveGame games[gameId].startArticle, games[gameId].endArticle, gameId
			client.leave 'listGames'
			client.join gameId
			client.set 'game', userSaveGame, callback
		else
			client.set 'game', null, callback

	leaveGame: (client, callback) ->
		await client.get 'game', defer(err, userSaveGame)
		if userSaveGame?
			id = userSaveGame.id
			# remove own username
			client.get 'username', (err, data) ->
				games[id].clients.splice games[id].clients.indexOf(data), 1
			client.leave id
			client.leave "#{id}-frozen"
			client.join 'listGames'
			--games[id].clientCount
			client.set 'game', null, callback

	freezeGame: (client) ->
		await client.get 'game', defer(err, userSaveGame)
		if userSaveGame?
			id = userSaveGame.id
			client.leave id
			client.join "#{id}-frozen"

	unfreezeGame: (client) ->
		await client.get 'game', defer(err, userSaveGame)
		if userSaveGame?
			id = userSaveGame.id
			client.leave "#{id}-frozen"
			client.join id

	startGame: (gameId) ->
		l.log 'game - start game with id: '+ gameId
		games[gameId].started = true

	listGames: (client) ->
		client.join 'listGames' if client?
		return games

	getGame: (gameId) ->
		return games[gameId] if games[gameId]?
		null

	inGame: (client, callback) ->
		await client.get 'game', defer(err, userSaveGame)
		callback if userSaveGame? then true else false

	next: (client, articleId, callback) ->
		args = {}
		await client.get 'game', defer(err, userSaveGame)
		return unless userSaveGame?
		game = games[userSaveGame.id]
		args.players = games[userSaveGame.id].clients
		unless game.started
			args.game = game
			return callback false, false, userSaveGame.id, args
		# get next article or startarticle
		if userSaveGame.links? and articleId?
			article = @getArticleFromLinkArray userSaveGame.links, articleId # next article
		else
			article = tools.uriEncode game.startArticle # start article
		l.log 'game - get next article: '+article
		await @getWikiContent article, defer(bodycontent, links, title)
		return unless bodycontent?
		userSaveGame.history.push title
		if title == game.endArticle
			l.log 'game - end article found: '+title, l.SUCCESS
			await client.get 'username', defer(err, username)
			args.username = username; args.history = userSaveGame.history
			return callback true, true, userSaveGame.id, args
		# title TODO: -> jade template
		bodycontent = "<h1 class='firstHeading'>#{title}</h1>#{bodycontent}"
		userSaveGame.links = links
		# inform other players
		client.get 'username', (err, username) =>
			@server.broadcast client: client, channel: userSaveGame.id, msg: "#{username} auf: #{title}"
		# update userlist
		@server.getUserPositions userSaveGame.id, (clients) =>
			@server.broadcast
				channel: userSaveGame.id
				template: 'userInfos'
				clientfunction: 'updateUserPositions'
				locals:
					clients: clients
		# save in user session
		client.set 'game', userSaveGame, ->
			args.bodycontent = bodycontent
			callback true, false, userSaveGame.id, args

	getArticleFromLinkArray: (links, id) ->
		article = links[id].match "href=\"/wiki/(.*?)\""
		article[1]

	getGameIndex: (game) ->
		games.indexOf game

	getWikiContent: (article, callback, trys) ->
		trys = 1 unless trys?
		cached = cache.get article
		if cached?
			l.log "cache - got '#{article}' from cache"
			return callback cached.bodycontent, cached.links, cached.title
		req_options =
			uri: 'http://de.wikipedia.org/wiki/'+article
			headers:
				'User-Agent': 'wikiway_js'
		await request req_options, defer(error, response, body)
		if not error and response.statusCode == 200
			parser = cheerio.load body
			# get article
			bodycontent = parser('#bodyContent').html()
			# get title
			title = parser('#firstHeading > span').text()
			# get internal links
			linkReg = new RegExp '<a href="/wiki/(.*?)".*?>(.*?)</a>', 'g'
			links = bodycontent.match linkReg, 'g'
			# TODO nicer loop w/o regex
			for link, i in links
				url = link.match 'href="(.*?)"'
				bodycontent = bodycontent.replace url[1], 'javascript:void(0)" action="next" art="'+i
			# remove edit links
			editReg = new RegExp '<span class="editsection">.*?</span>', 'g'
			edits = bodycontent.match editReg, 'g'
			if edits?
				for edit in edits
					bodycontent = bodycontent.replace edit, ''
			# remove external links
			externalReg = new RegExp '<a.*?href=".*?</a>', 'g'
			externals = bodycontent.match externalReg, 'g'
			if externals?
				for external in externals
					unless external.match '.*?href=".*?".*?load=.*?|.*?href="javascript.*?|.*?href="#.*?'
						text = external.match '>(.*?)</a>'
						bodycontent = bodycontent.replace external, text[1]
			# put article in cache
			cache.put article,
				bodycontent: bodycontent
				links: links
				title: title,
				CACHE_TIME
			l.log "cache - put #{article} to cache"
			return callback bodycontent, links, title
		else
			l.log "game - failed to load wikipedia article: #{article}, error: #{error} statuscode: #{response.statusCode}, try: #{trys}", l.ERROR
			# retry 5 times
			if trys < 5
				@getWikiContent article, callback, trys + 1
			else
				callback null, null, null

	# TODO nicer method to update
	updateGameList: (game, prop, oldVal, newVal) ->
		id = @getGameIndex game
		unless game.started
			@server.broadcast 
				template: 'waitingroom'
				channel: id
				locals:
					game: game
					players: game.clients
					gameId: id
		@server.broadcast
			template: 'listGames'
			channel: 'listGames',
			locals:
				games: games
		return newVal

exports.GameController =  GameController
