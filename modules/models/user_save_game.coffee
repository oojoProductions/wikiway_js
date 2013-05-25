###
wikiway
Authors: Andrin Schnegg (andrin[at]schnegg.biz),
         Sebastian Widmer (widmer.sebastian[at]gmail.com)
Version: Experimental
Date:    25.05.2013
###

class UserSaveGame
	constructor: (startArticle, endArticle, id) ->
		@startArticle = startArticle
		@endArticle = endArticle
		@id = id
		@history = []
		@links = []

exports.UserSaveGame = UserSaveGame
