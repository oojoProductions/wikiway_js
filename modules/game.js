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
exports.newGame = function(startArticle, endArticle){
	//If Articles not defined return false
	if (startArticle == null || endArticle == null || startArticle == "" || endArticle == "") return false;
	//Save Game in Array and return true
	games.push(new Object({startArticle: startArticle, endArticle: endArticle}));
	return true;
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
		//Client joins socket.io room for game
		client.join(gameId);
		//Set game object
		client.set('game', gameObject, callback);
	}
};

//List all Games
exports.listGames = function(){
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
function getWikiContent(article, callback){
	request("http://de.wikipedia.org/wiki/"+article, function (error, response, body) {
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
			console.log('game - failed to load wikipedia article: '+article);
			callback(null, null);
		}
	});
};
