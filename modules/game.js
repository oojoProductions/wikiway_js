/*
*	wikiway
*	Authors: Andrin Schnegg (andrin[at]schnegg.biz),
*			 Sebastian Widmer (widmer.sebastian[at]gmail.com)
*	Version: Experimental
*	Datum:   11.05.2012
*/
//Needs Request to work
var request = require('request'),
		cache = require('memory-cache'),
		cheerio = require('cheerio');

//require server.js
var server = require('./../server.js'),
	tools = require('./tools.js'),
	l = require('./log.js');

//Array where all the Games are saved
var games = new Array();

//Time for Caching Wikipedia articles
const CACHE_TIME = 5*60*1000; //ms

//Object Game
function Game(startArticle, endArticle){
	this.startArticle = startArticle;
	this.endArticle = endArticle;
	//--
	this.clientCount = 0;
	this.clients = new Array();
	this.started = false;
	this.won = false;
	//Watch changes of clientcount
	this.watch('clientCount', function(obj, prop, oldVal, newVal) {
		return updateGameList(obj, prop, oldVal, newVal)
	});
};
//Object UserSaveGame
function UserSaveGame(startArticle, endArticle, id)
{
	this.startArticle = startArticle;
	this.endArticle = endArticle;
	this.id = id;
	//--
	this.history = new Array();
	this.links = new Array();
};

//Fill Games array for debug
games.push(new Game('Coop', 'Migros'));
games.push(new Game('Aldi', 'Lidl'));

//Make New Game
exports.newGame = function(startArticle, endArticle, client, callback){
	//Leave listGames channel
	client.leave('listGames');
	//General checks
	if (startArticle == null || endArticle == null || startArticle == "" || endArticle == "" || startArticle == endArticle)
		return callback(false);

	//request options; only load head
	var options = {
		uri: 'http://de.wikipedia.org/wiki/'+tools.uriEncode(startArticle),
		method: "HEAD",
		headers: {'User-Agent': 'wikiway_js'}
	};
	//check if startArticle exists
	request(options, function(error, response, body){
		if (response.statusCode != 200)
		{
			l.log('game - startarticle ('+startArticle+') not found', l.WARN);
			return callback(false);
		}
		//Get titel for endarticle
		getWikiContent(tools.uriEncode(endArticle), function(bodycontent, links, title){
			//Check if Article exists
			if (title == null) {
				l.log('game - endarticle ('+endArticle+') not found', l.WARN);
				return callback(false)
			};
			//if everything is ok create game and fire callback
			games.push(new Game(startArticle, title));
			l.log('game - new game created: '+startArticle+' to ' + title + ' ('+endArticle + ')', l.SUCCESS);
			//Call callback
			return callback(true);
		});
	});

};

//Join Game
exports.joinGame = function(client, gameId, callback){
	if (!(gameId in games))
	{
		client.set('game', null, callback);
	}
	else
	{	
		client.get('username', function(err,data) {
			games[gameId]['clients'].push(data);
		});
		//++clientCount
		++games[gameId]['clientCount'];
		//Create Game Object for User
		var userSaveGame = new UserSaveGame(games[gameId].startArticle, games[gameId].endArticle, gameId);
		//Client joins socket.io room for game and leaves room listGames
		client.leave('listGames');
		client.join(gameId);
		//Set game object
		client.set('game', userSaveGame, callback);
	}
};

//Freeze Game so the user gets not disturbed
exports.freezeGame = function(client){
	client.get('game', function(err, userSaveGame){
		if (!(userSaveGame == null))
		{   
			var id = userSaveGame.id;
			//Change Channel
			client.leave(id);
			client.join(id+'-frozen');
		}
	});
};

//Unfreeze Game
exports.unfreezeGame = function(client){
	client.get('game', function(err, userSaveGame){
		if (!(userSaveGame == null))
		{   
			var id = userSaveGame.id;
			//Change Channel
			client.leave(id+'-frozen');
			client.join(id);
		}
	});
};

//Leave Game
exports.leaveGame = function(client, callback){
	client.get('game', function(err, userSaveGame){
		if (!(userSaveGame == null))
		{   
			var id = userSaveGame.id;
			//Delete username from list
			client.get('username', function(err,data) {
				games[id]['clients'].splice(games[id]['clients'].indexOf(data),1);
			});
			//Change Channel
			client.leave(id);
			client.leave(id+'-frozen');
			client.join('listGames');
			//Update clientCount to notify others
			--games[id]['clientCount'];
			//Set Game null
			client.set('game', null, callback);
		}
	});

};

//Start Game
exports.startGame = function(gameId) {
	l.log('game - start game with id: '+ gameId);
	games[gameId]['started'] = true;
};

//List all Games and join listGames channel if client is set
exports.listGames = function(client){
	if (typeof client != 'undefined')
	{
		client.join('listGames');
	}
	return games;
};

//Show single Game
exports.getGame = function(gameId){
	if (gameId in games) return games[gameId];
	return null;
};

//Checks if user is in Game
exports.inGame = function(client, callback){
	client.get('game', function(err, userSaveGame){
		if (userSaveGame == null)
		{
			callback(false);
		}
		else
		{
			callback(true);
		}
	});
};

//Next Step for User
exports.next = function(client, articleId, callback){
	//Array with optional variables for callback
	var args = new Array();
	//Get User specific stuff
	client.get('game', function(err, userSaveGame){
		//Output all players in game
		args['players'] = games[userSaveGame.id]['clients'];
		//Check if user is in game, if not do nothing
		if (userSaveGame == null) return;
		//
		if (!(games[userSaveGame.id].started))
		{
			args['game'] = games[userSaveGame.id];
			return callback(false, false, userSaveGame.id, args);
		}
		//Get next Article
		var article;
		if (userSaveGame.links && articleId != null)
		{
			//Normal case, gets article from link array
			article = getArticleFromLinkArray(userSaveGame.links, articleId);
		}
		else
		{
			//Goto Startarticle
			article = tools.uriEncode(games[userSaveGame.id].startArticle);
		}
		//Logging
		l.log('game - next article: '+article);
		//Get requested article from Wikipedia
		getWikiContent(article, function(bodycontent, links, title){
			//if article could not load do nothing
			if(bodycontent==null) return;
			//Fill history
			userSaveGame.history.push(title);
			//Check if user wins the game
			if (title === games[userSaveGame.id].endArticle)
			{
				//Logging
				l.log('game - end article found: '+title, l.SUCCESS);
				//Get client username
				client.get('username', function(err, username){
					//History and winner for game over screen
					args["username"] = username;
					args["history"] = userSaveGame.history;
					return callback(true, true, userSaveGame.id, args);
				});
				return;
			}
			//ad title to bodycontent (very ugly -> jade template)
			bodycontent = '<h1 class="firstHeading">'+title+'</h1>'+bodycontent;
			//Set Links to use Later
			userSaveGame.links = links;
			//inform all players in game about article (debug)
			client.get('username', function(err, username) {
				server.broadcast({client: client, channel: userSaveGame.id, msg: username+' auf: '+title});
			});
			
			// update userlists
			server.getUserPositions(userSaveGame.id, function(clients){
				var args = new Array();
				args.channel = userSaveGame.id;
				args.template = 'userInfos';
				args.clientfunction = 'updateUserPositions';
				var locals = new Array();
				locals.clients = clients;
				args.locals = locals;
				server.broadcast(args);
			});	
				
			//Save the whole thing in the user session
			client.set('game', userSaveGame,function(){
				args['bodycontent'] = bodycontent;
				callback(true, false, userSaveGame.id, args);
			});
		});
	});
};

//Private function to get full article from id
function getArticleFromLinkArray(links, id){
	var article = links[id];
	article = article.match("href=\"/wiki/(.*?)\"");
	article = article[1];
	return article;
}
//Private function to get index of game
function getIndexOfGame(game){
	return games.indexOf(game);
}

//Private function get Wikipedia article
function getWikiContent(article, callback, trys){
	//Set trys back if not set
	if (trys == null) trys = 1;

	//get Cache
	var cached = cache.get(article);
	//If article already in cache get it from cache
	if (cached != null){
		l.log('cache - got '+article+' from cache');
		return callback(cached['bodycontent'], cached['links'], cached['title']);
	}

	//options for request, User-Agent in header is important to not get blocked from wikipedia because of to many requests
	var options = {
		uri: 'http://de.wikipedia.org/wiki/'+article,
		headers: {'User-Agent': 'wikiway_js'}
	};
	//Get Wikipedia article
	request(options, function (error, response, body) {
		//Is Page valid?
		if (!error && response.statusCode == 200) {
			var parser = cheerio.load(body);

			//get article
			bodycontent = parser('#bodyContent').html();
			
			//get title
			title = parser('#firstHeading > span').text()
			
			//Define the regex for all wikilinks
			var regexLink = new RegExp('<a href="/wiki/(.*?)".*?>(.*?)</a>',"g");
			
			//Build Link Array
			var links = bodycontent.match(regexLink, "g");
			for(var i=0; i<links.length; i++) {
				var value = links[i];
				var url = value.match("href=\"(.*?)\"");
				bodycontent = bodycontent.replace(url[1], "javascript:void(0)\" action=\"next\" art=\""+i);
			}

			//Remove edit links
			var editsRegex = new RegExp('<span class="editsection">.*?</span>',"g");
			var edits = bodycontent.match(editsRegex, "g");
			if (!(edits == null))
			{
				for(var i=0; i<edits.length; i++) {
					edit = edits[i];
					bodycontent = bodycontent.replace(edit, "");
				}
			}
			//Remove all external links
			var extlinkRegex = new RegExp('<a.*?href=".*?</a>',"g");
			var extlinks = bodycontent.match(extlinkRegex, "g");
			if (!(extlinks == null))
			{
				for(var i=0; i<extlinks.length; i++) {
					var extlink = extlinks[i];
					if(!extlink.match('.*?href=".*?".*?load=.*?|.*?href="javascript.*?|.*?href="#.*?')){
						var text = extlink.match(">(.*?)</a>");
						bodycontent = bodycontent.replace(extlink, text[1]);
					}
				}
			}
			//Save Article in Cache
			cache.put(
				article,
				{
					bodycontent: bodycontent,
					links: links,
					title: title
				},
				CACHE_TIME
			);
			l.log('cache - put '+article+' to cache');
			//Call callback with the content of wikipedia and the links array
			return callback(bodycontent, links, title);
		}else{
			l.log('game - failed to load wikipedia article: '+article+', Fehler: '+error+' Statuscode: '+response.statusCode+' Versuch: '+trys, l.ERROR);
			//Retry 5 times then call callback with no output
			if (trys < 5){
				getWikiContent(article, callback, trys + 1);
			}
			else
			{
				return callback(null, null, null);
			}
		}
	});
};

//Functions for watched variables
function updateGameList (game, prop, oldVal, newVal) {
	var id = getIndexOfGame(game);
	l.log('game - ID:'+id+' '+prop+' changed from '+oldVal+' to '+newVal);
	//Update Waitingroom
	if (!game.started){		
		server.broadcast({template: 'waitingroom', channel: id, locals: {game: game, players: game.clients, gameId: id}});
	}
	//Update Game List
	server.broadcast({template: 'listGames', channel: 'listGames', locals: {games: games}});
	return newVal;
}
