/*
*	wikiway
*	Authors: Andrin Schnegg (andrin[at]schnegg.biz),
*			 Sebastian Widmer (widmer.sebastian[at]gmail.com)
*	Version: Experimental
*	Datum:   11.05.2012
*/
//Needs Request to work
var request = require('request');

//require server.js
var server = require('./../server.js');

//Array where all the Games are saved
var games = new Array();

//Fill Games array for debug
games[0] = new Object();
games[0]["startArticle"] = "Coop";
games[0]["endArticle"] = "Migros";

games[1] = new Object();
games[1]["startArticle"] = "Aldi";
games[1]["endArticle"] = "Lidl";

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
		//Replace " " with "_"
		startArticle.replace(' ','_');
		endArticle.replace(' ','_');
		//request options; only load head
		var options = {
			uri: 'http://de.wikipedia.org/wiki/'+startArticle,
			method: "HEAD",
			headers: {'User-Agent': 'wikiway_js'}
		};
		//check if startArticle exists
		request(options, function(error, response, body){
			if (response.statusCode != 200)
			{
				callback(false);
				return;
			}
			else
			{
				options.uri = 'http://de.wikipedia.org/wiki/'+endArticle;
				//check if endArticle exists
				request(options, function(error, response, body){
					if (response.statusCode != 200)
					{
						callback(false);
						return;
					}
					else
					{
						//if everything is ok create game and fire callback
						console.log('game - new game created');
						games.push(new Object({startArticle: startArticle, endArticle: endArticle}));
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
		//Create Game Object for User
		gameObject = new Object();
		gameObject['id'] = gameId;
		gameObject['history'] = Array();
		gameObject['links'] = Array();
		//Client joins socket.io room for game and leaves room listGames
		client.leave('listGames');
		client.join(gameId);
		//Set game object
		client.set('game', gameObject, callback);
	}
};

//Leave Game
exports.leaveGame = function(client, gameId){
	//Set Game null
	client.set('game', null);
	//Leave Gamechannel
	client.leave(gameId);
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
	//Get User specific stuff
	client.get('game', function(err, gameObject){
		
		//Check if user is in game, if not do nothing
		if (gameObject == null) return;
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
			if (gameObject.history.lenght)
			{
				article = gameObject.history[gameObject.history.lenght-1];
			}
			else
			{
				article = games[gameObject.id].startArticle;
			}
		}
		//Check if user wins the game
		if (article === games[gameObject.id].endArticle)
		{
			//Debug
			console.log('game - end article found: '+article);
			gameObject.history.push(article);
			callback(true, null, gameObject.history, gameObject.id);
			return;
		}
		//Get requested article from Wikipedia
		getWikiContent(article, function(bodycontent, links){
			//if article could not load do nothing
			if(bodycontent==null) return;
			//Set Links to use Later
			gameObject.links = links;
			//Set Article History
			gameObject.history.push(article);
			//inform all players in game about article (debug)
			client.get('username', function(err, username){
				server.broadcastMsgGame(client, gameObject.id , username+" auf: "+article);
			});
			//Save the whole thing in the user session
			client.set('game', gameObject,function(){
				callback(false, bodycontent, gameObject.history, gameObject.id);
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
//Private function get Wikipedia article
function getWikiContent(article, callback, trys){
	//Set trys back if not set
	if (trys == null) trys = 1;
	//options for request, User-Agent in header is important to not get blocked from wikipedia because of to many requests
	var options = {
		uri: 'http://de.wikipedia.org/wiki/'+article,
		headers: {'User-Agent': 'wikiway_js'}
	};
	//Get Wikipedia article
	request(options, function (error, response, body) {
		//Is Page valid?
		if (!error && response.statusCode == 200) {
			var regex = '<!-- bodyContent -->((.|\n|\r)*)<!-- /bodycontent -->';
			var bodycontent = body.match(regex);
			bodycontent = bodycontent[1];
			var linkRegex = new RegExp('<a href="/wiki/(.*?)".*?>(.*?)</a>',"g");
			
			//Build Link Array
			var links = bodycontent.match(linkRegex, "g");
			for(var i=0; i<links.length; i++) {
				var value = links[i];
				var url = value.match("href=\"(.*?)\"");
				bodycontent = bodycontent.replace(url[1], "#\" action=\"next\" art=\""+i);
			}

			// remove edit links
			var editsRegex = new RegExp('<span class="editsection">.*?</span>',"g");
			var edits = bodycontent.match(editsRegex, "g");
			if (!(edits == null))
			{
				for(var i=0; i<edits.length; i++) {
					edit = edits[i];
					bodycontent = bodycontent.replace(edit, "");
				}
			}
			// remove all external links
			var extlinkRegex = new RegExp('<a.*?href=".*?</a>',"g");
			var extlinks = bodycontent.match(extlinkRegex, "g");
			if (!(extlinks == null))
			{
				for(var i=0; i<extlinks.length; i++) {
					var extlink = extlinks[i];
					if(!extlink.match('.*?href=".*?".*?load=.*?|.*?class="image".*?|.*?href="#.*?')){
						var text = extlink.match(">(.*?)<");
						bodycontent = bodycontent.replace(extlink, text[1]);
					}
				}
			}
			
			//Call callback with the content of wikipedia and the links array
			callback(bodycontent, links);
		}else{
			console.log('game - failed to load wikipedia article: '+article+', Fehler: '+error+' Statuscode: '+response.statusCode+' Versuch: '+trys);
			//Retry 5 times then call callback with no output
			if (trys < 5){
				getWikiContent(article, callback, trys + 1);
			}
			else
			{
				callback(null, null);
			}
		}
	});
};
