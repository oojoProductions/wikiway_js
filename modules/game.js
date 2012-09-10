/*
*	wikiway
*	Authors: Andrin Schnegg (andrin[at]schnegg.biz),
*			 Sebastian Widmer (widmer.sebastian[at]gmail.com)
*	Version: Experimental
*	Datum:   11.05.2012
*/
//Needs Request to work
var request = require('request'),
	cache = require('memory-cache');

//require server.js
var server = require('./../server.js'),
	tools = require('./tools.js'),
	l = require('./log.js');

//Array where all the Games are saved
var games = new Array();

//Time for Caching Wikipedia articles
const CACHE_TIME = 5*60*1000; //ms

//Fill Games array for debug
games[0] = new Object();
games[0]["startArticle"] = "Coop";
games[0]["endArticle"] = "Migros";
games[0]["clientCount"] = 0;
games[0]["clients"] = new Array();
games[0]["started"] = false;
games[0]["won"] = false;
games[0].watch('clientCount', function(obj, prop, oldVal, newVal) {return updateGameList(obj, prop, oldVal, newVal)});

games[1] = new Object();
games[1]["startArticle"] = "Aldi";
games[1]["endArticle"] = "Lidl";
games[1]["clientCount"] = 0;
games[1]["clients"] = new Array();
games[1]["started"] = false;
games[1]["won"] = false;
games[1].watch('clientCount', function(obj, prop, oldVal, newVal) {return updateGameList(obj, prop, oldVal, newVal)});

//Make New Game
exports.newGame = function(startArticle, endArticle, client, callback){
	//Leave listGames channel
	client.leave('listGames');
	//General checks
	if (startArticle == null || endArticle == null || startArticle == "" || endArticle == "" || startArticle == endArticle)
	{
		callback(false);
		return;
	}
	else
	{
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
				callback(false);
				l.log('game - startarticle ('+startArticle+') not found', l.WARN);
				return;
			}
			else
			{
				options.uri = 'http://de.wikipedia.org/wiki/'+tools.uriEncode(endArticle);
				//check if endArticle exists
				request(options, function(error, response, body){
					if (response.statusCode != 200)
					{
						callback(false);
						l.log('game - endarticle ('+endarticle+') not found', l.WARN);
						return;
					}
					else
					{
						//if everything is ok create game and fire callback
						l.log('game - new game created: '+startArticle+' to ' +endArticle, l.SUCCESS);
						game = new Object
						(
							{
								startArticle: startArticle,
								endArticle: endArticle,
								clientCount: 0,
								clients: new Array(),
								started: false,
								won: false,
							}
						);
						//Monitor changes in clientCount to notify other clients
						game.watch('clientCount', function(obj, prop, oldVal, newVal) {return updateGameList(obj, prop, oldVal, newVal)});
						//Push to array
						games.push(game);
						//Call callback
						callback(true);
					}
				});
			}
		});
	}
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
		gameObject = new Object();
		gameObject['id'] = gameId;
		gameObject['history'] = Array();
		gameObject['links'] = Array();
		gameObject['startArticle'] = games[gameId].startArticle;
		gameObject['endArticle'] = games[gameId].endArticle;
		//Client joins socket.io room for game and leaves room listGames
		client.leave('listGames');
		client.join(gameId);
		//Set game object
		client.set('game', gameObject, callback);
	}
};

//Freeze Game so the user gets not disturbed
exports.freezeGame = function(client){
	client.get('game', function(err, gameObject){
		if (!(gameObject == null))
		{   
			var id = gameObject.id;
			//Change Channel
			client.leave(id);
			client.join(id+'-frozen');
		}
	});
};

//Unfreeze Game
exports.unfreezeGame = function(client){
	client.get('game', function(err, gameObject){
		if (!(gameObject == null))
		{   
			var id = gameObject.id;
			//Change Channel
			client.leave(id+'-frozen');
			client.join(id);
		}
	});
};

//Leave Game
exports.leaveGame = function(client, callback){
	client.get('game', function(err, gameObject){
		if (!(gameObject == null))
		{   
			var id = gameObject.id;
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
	client.get('game', function(err, gameObject){
		if (gameObject == null)
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
	client.get('game', function(err, gameObject){
		//Output all players in game
		args['players'] = games[gameObject.id]['clients'];
		//Check if user is in game, if not do nothing
		if (gameObject == null) return;
		//
		if (!(games[gameObject.id].started))
		{
			args['game'] = games[gameObject.id];
			callback(false, false, gameObject.id, args);
			return;
		}
		//Get next Article
		var article;
		if (gameObject.links && articleId != null)
		{
			//Normal case, gets article from link array
			article = getArticleFromLinkArray(gameObject.links, articleId);
		}
		else
		{
			//Use startArticle if there is no history (user is new in game)
			if (gameObject.history.length)
			{
				article = tools.uriEncode(gameObject.history[gameObject.history.length-1]);
			}
			else
			{
				article = tools.uriEncode(games[gameObject.id].startArticle);
			}
		}
		//Logging
		l.log('game - next article: '+article);
		//Check if user wins the game
		if (article === tools.uriEncode(games[gameObject.id].endArticle))
		{
			//Debug
			l.log('game - end article found: '+article, l.SUCCESS);
			gameObject.history.push(tools.uriDecode(article));
			//Define history as optional variable
			args["history"] = gameObject.history;
			//Get client username
			client.get('username', function(err, username){
				//Define username as optional variable
				args["username"] = username;
				callback(true, true, gameObject.id, args);
			});
			return;
		}
		//Get requested article from Wikipedia
		getWikiContent(article, function(bodycontent, links, title){
			//if article could not load do nothing
			if(bodycontent==null) return;
			//ad title to bodycontent (very ugly -> jade template)
			bodycontent = '<h1 class="firstHeading">'+title+'</h1>'+bodycontent;
			//Set Links to use Later
			gameObject.links = links;
			//Set Article History
			gameObject.history.push(tools.uriDecode(article));
			//inform all players in game about article (debug)
			client.get('username', function(err, username) {
				server.broadcast({client: client, channel: gameObject.id, msg: username+' auf: '+tools.uriDecode(article)});
			});
			
			// update userlists
			server.getUserPositions(gameObject.id, function(clients){
				var args = new Array();
				args.channel = gameObject.id;
				args.template = 'userInfos';
				args.clientfunction = 'updateUserPositions';
				var locals = new Array();
				locals.clients = clients;
				args.locals = locals;
				server.broadcast(args);
			});	
				
			//Save the whole thing in the user session
			client.set('game', gameObject,function(){
				args['bodycontent'] = bodycontent;
				callback(true, false, gameObject.id, args);
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
		callback(cached['bodycontent'], cached['links'], cached['title']);
		l.log('cache - got '+article+' from cache');
		return;
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
			//grab contentdiv from wiki article
			var regexContent = '<!-- bodyContent -->[\\S\\s]*<!-- /bodyContent -->';
			var bodycontent = body.match(regexContent);
			bodycontent = bodycontent[0];
			
			//grab titlediv from wiki article
			var regexTitleBlock = '<!-- firstHeading -->[\\S\\s]*<!-- /firstHeading -->';
			var titleBlock = body.match(regexTitleBlock);
			titleBlock = titleBlock[0];
			var regexTitle = new RegExp('<span dir="auto">(.*?)</span>');
			var title = titleBlock.match(regexTitle);
			title = title[1];
			
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
			callback(bodycontent, links, title);
		}else{
			l.log('game - failed to load wikipedia article: '+article+', Fehler: '+error+' Statuscode: '+response.statusCode+' Versuch: '+trys, l.ERROR);
			//Retry 5 times then call callback with no output
			if (trys < 5){
				getWikiContent(article, callback, trys + 1);
			}
			else
			{
				callback(null, null, null);
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
