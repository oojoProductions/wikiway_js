###
wikiway
Authors: Andrin Schnegg (andrin[at]schnegg.biz),
         Sebastian Widmer (widmer.sebastian[at]gmail.com)
Version: Experimental
Date:    25.05.2013
###

class Game
	constructor: (startArticle, endArticle, handler) ->
		@startArticle = startArticle
		@endArticle = endArticle
		@clientCount = 0
		@clients = []
		@started = false
		@won = false
		# watch changes of clientcount
		@watch 'clientCount', (obj, prop, oldVal, newVal) ->
			handler?.updateGameList obj, prop, oldVal, newVal

exports.Game = Game
