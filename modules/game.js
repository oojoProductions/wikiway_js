/*
*	wikiway
*	Authors: Andrin Schnegg (andrin[at]schnegg.biz),
*			 Sebastian Widmer (widmer.sebastian[at]gmail.com)
*	Version: Experimental
*	Datum:   11.05.2012
*/

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
exports.createGame = function(startArticle, endActicle){
	return "";
};

//Join Game
exports.joinGame = function(gameId){
	return 0;
};

//List all Games
exports.listGames = function(){
	return games;
};

//Checks if user is in Game
exports.checkUser = function(client){
	return 0;
};

//Next Step for User
exports.checkUser = function(client){
	return 0;
};
