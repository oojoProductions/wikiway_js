﻿/*
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
		client.set('game', gameId, callback);
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
exports.checkUser = function(client){
	return 0;
};

//Next Step for User
exports.next = function(client){
	return 0;
};