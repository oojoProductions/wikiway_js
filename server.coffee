###
wikiway
Authors: Andrin Schnegg (andrin[at]schnegg.biz),
         Sebastian Widmer (widmer.sebastian[at]gmail.com)
Version: Experimental
Date:    25.05.2013
###
class WikiwayServer
	# include template functions and tools
	template = require './modules/helpers/templ.js'; r = template.render
	tools = require './modules/helpers/tools.js'
	l = require './modules/helpers/log.js'
	express = require 'express'
	app 		= express()
	http 		= require 'http'
	server 	= http.createServer app
	io 			= require('socket.io').listen server
	
	constructor: ->
		# extension for object prototype, now its possible to watch changes in an object
		require('./modules/object_watch').init()

		# game controller
		GameController = require('./modules/controllers/game_controller').GameController
		@gameController = new GameController this


		# development port
		port = 1337
		# override default port if port is set
		args = process.argv.splice 2
		port = args[0] if arguments.length and not isNaN args[0]

		# start server
		server.listen port

		# less messages from socket.io
		io.set 'log level', 1

		# static files
		app.use express.static(__dirname + '/public')
		# index file on root path
		app.get '/', (req, res) ->
			await r 'index', null, defer(data)
			res.send data

		# socket.io
		# ------------------------

		#keep track how many clients are connected
		clientCount = 0

		io.sockets.on 'connection', (client) =>
			++clientCount
			l.log 'client - connected, IP:'+client.handshake.address.address, l.SUCCESS

			# first time client loads webpage
			client.on 'init', =>
				@refresh client
				client.emit 'growl', "Willkommen! "+clientCount+ " Spieler verbunden.", 0
				r 'getUsername', null, (data) ->
					client.emit 'getUsername', data

			# client lists games
			client.on 'listGames', =>
				@clearFooter()
				@updateFooterWikiwayTitle client, (data) ->
					client.emit 'updateFooterWikiwayTitle', data
				r 'listGames', {games: @gameController.listGames(client)}, (data) ->
					client.emit 'updateContent', data

			# client creates game
			client.on 'newGame', (startArticle, endArticle) =>
				# escape input
				startArticle = tools.escape startArticle
				endArticle = tools.escape endArticle
				# create game
				await @gameController.newGame startArticle, endArticle, client, defer(success)
				if success
					r 'listGames', {games: @gameController.listGames(client)}, (data) ->
						#update game list for clients in listGame and send messages
						cl = io.sockets.in('listGames')
						cl.emit 'updateContent', data
						cl.emit 'growl', 'Neues Spiel erstellt', 0
				else
					r 'newGame', null, (data) ->
						client.emit 'updateContent', data

			# client joins game
			client.on 'joinGame', (gameId) =>
				await @gameController.joinGame client, gameId, defer()
				# update footer
				@updateFooterWikiwayTitle client, (data) ->
					client.emit 'updateFooterWikiwayTitle', data
				# load first article
				@gameController.next client, null, (started, win, gameId, args) ->
					if started
						client.emit 'updateContent', args.bodycontent
					else
						r 'waitingroom', {game: args.game, players: args.players, gameId: gameId}, (data) ->
							client.emit 'updateContent', data
				# update game list for others - NEEDED?
				r 'listGames', {games: @gameController.listGames()}, (data) ->
					io.sockets.in('listGames').emit 'updateContent', data

			# client leaves game
			client.on 'leaveGame', =>
				@gameController.leaveGame client, =>
					@updateFooterWikiwayTitle client, (data) ->
						client.emit 'updateFooterWikiwayTitle', data

			# start games
			client.on 'startGame', (gameId) =>
				return unless gameId?
				@gameController.startGame gameId
				for clientInGame in io.sockets.clients gameId
					do (clientInGame) =>
						@gameController.next clientInGame, null, (started, win, gameId, args) ->
							clientInGame.emit 'updateContent', args.bodycontent

			# client want's next article
			client.on 'next', (articleId) =>
				await @gameController.next client, articleId, defer(started, win, gameId, args)
				if win
					history = args['history']; username = args['username']
					r 'win', {history: history}, (data) ->
						client.emit 'updateContent', data
					r 'lose', {history: history, winner: username}, (data) =>
						client.broadcast.in(gameId).emit 'updateContent', data
						for clientInGame in io.sockets.clients gameId
							@gameController.freezeGame clientInGame
				else
					client.emit 'updateContent', args['bodycontent']

			# set username
			client.on 'setUsername', (name) =>
				# escape input
				name = tools.escape name
				await client.set 'username', name, defer()
				client.emit 'hideSetUsername'
				client.get 'username', (err, name) ->
					client.emit 'growl', "Dein Benutzername #{name}", 0
					l.log "server - set username: #{name}"

			# refresh page
			client.on 'refresh', => @refresh client

			# chat
			client.on 'chatSender', =>
				# escape input
				messages =  tools.escape message
				# user in game?
				await @gameController.inGame client, defer(inGame)
				if inGame
					await client.get 'game', defer(err, game)
					@broadcast
						client: client
						chatmessage: message
						channel: game.id
				else
					@broadcast
						client: client
						chatmessage: message
						channel: game.id

			# client disconnects
			client.on 'disconnect', =>
				--clientCount
				@gameController.leaveGame client
				l.log 'client - disconnected, IP:'+client.handshake.address.address, l.WARN
		# ------------------------
		l.log 'server - started on port '+port, l.SUCCESS

		###
		# ugly uncaught exeption handling
		process.on 'uncaughtException', (err) ->
		  l.log 'uncaught exeption', l.ERROR
		  console.log '--------------------------------------'
		  console.log err.stack
		  console.log '--------------------------------------'
		###

	# server broadcasts a message or data. args: client, msg, msgType, channel, template, locals, clientfunction, chatmessage
	broadcast: (args) ->
		switch
			when args.chatmessage? # is chatmessage
				args.client?.get 'username', ->
					io.sockets.in(args.channel).emit 'chatReceiver', username, args.chatmessage

			when args.msg? # is systemmessage
				args.msgType = 2 unless args.msgType?
				if args.client?
					if args.channel?
						args.client.broadcast.in(args.channel).emit 'growl', args.msg, args.MsgType
					else
						args.client.broadcast.emit 'growl', args.msg, args.MsgType
				else
					if args.channel?
						io.sockets.in(args.channel).emit 'growl', args.msg, args.MsgType
					else
						io.sockets.emit 'growl', args.msg, args.MsgType

			when args.template? # is template
				await r args.template, args.locals, defer(rendered)
				args.clientfunction = 'updateContent' unless args.clientfunction?
				if args.client?
					if args.channel?
						args.client.broadcast.in(args.channel).emit args.clientfunction, rendered
					else
						args.client.broadcast.emit args.clientfunction, rendered
				else
					if args.channel?
						io.sockets.in(args.channel).emit args.clientfunction, rendered
					else
						io.sockets.emit args.clientfunction, rendered

	refresh: (client) ->
		await @gameController.inGame client, defer inGame
		if inGame
			# load last article
			@gameController.next client, null, (win, bodycontent, gameId, args) ->
				client.emit 'updateContent', args.bodycontent
			# update userlist
			client.get 'game', (err, game) ->
				await @getUserPositions game.id, defer(clients)
				broadcast
					channel: game.id
					template: 'userInfos'
					clientfunction: 'updateUserPositions'
					locals:
						clients: clients
		else
			r 'listGames', { games: @gameController.listGames(client) }, (data) ->
				client.emit 'updateContent', data

	clearFooter: ->
		# update userlist with empty clients array
		broadcast
			channel: 'listGames'
			template: 'userInfos'
			clientfunction: 'updateUserPositions'
			locals:
				clients: []

	getUserPositions: (channel, callback) ->
		clientsInGame = io.sockets.clients(channel)
		out = []
		for clientInGame, index in clientsInGame
			await clientInGame.get 'username', defer(err, username)
			await clientInGame.get 'game', defer(err, game)
			lastItem = game.history[game.history.length-1]
			out[index] = [username, lastItem]
		callback out

	updateFooterWikiwayTitle: (client, callback) ->
		client.get 'game', (err, game) ->
			r 'footerTitle', { actGame: game }, (data) ->
				callback data

server = new WikiwayServer()























