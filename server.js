/*
*	wikiway
*	Authors: Andrin Schnegg (andrin[at]schnegg.biz),
*			 Sebastian Widmer (widmer.sebastian[at]gmail.com)
*	Version: Experimental
*	Datum:   11.05.2012
*/

//wikiway uses express and socket.io
var express = require('express'),
	socketio = require('socket.io');

//Include main game functions
var game = require('./modules/game.js');
//Include template functions
var templ = require('./modules/templ.js');

//Port for Game
var port = 1337;

//Define Server
var server = express.createServer();
var io = socketio.listen(server);
//Less log messages from socket.io
io.set('log level', 1);
//Serve files in public/ folder
server.use(express.static(__dirname + '/public'));

//Socket IO logic
//--------------------------------
io.sockets.on('connection', function(client) {
	console.log('client - connect');
	//Client loads Webpage
	client.on('init', function() {
		console.log('client - init from browser');
        //Check if user is in game
		game.inGame(client, function (inGame){
			if (inGame)
			{	
				//If user is in game serve last article
				game.next(client, null, function(wiki){
					client.emit('updateContent', wiki);
				});
			}
			else
			{	
				//If user is not in game serve list of games
				templ.render('listGames', {games: game.listGames()}, function (data){
					client.emit('updateContent', data);
				});
			}
		});

		//Test for jGrowl
		client.emit('jGrowl', 'Hallo Welt!', 0);
    });
	//List all Games
	client.on('listGames', function() {
		templ.render('listGames', {games: game.listGames()}, function (data){
			client.emit('updateContent', data);
		});
	});
	
	//Client creates new game or show form if start and endarticle == null
	client.on('newGame', function(startArticle, endArticle) {
		if (game.newGame(startArticle, endArticle))
		{
			templ.render('listGames', {games: game.listGames()}, function (data){
				client.emit('updateContent', data);
			});
		}
		else
		{
			templ.render('newGame', null, function (data){
				client.emit('updateContent', data);
			});
		}
	});
	
	//Client joins game
	client.on('joinGame', function(gameId) {
		game.joinGame(client, gameId, function(){
			//Goto first article
			game.next(client, null, function(wiki){
				client.emit('updateContent', wiki);
			});
		});
	});
	
	//Next article
	client.on('next', function(articleId) {
		console.log('client - next article');
		game.next(client, articleId, function(wiki){
			client.emit('updateContent', wiki);
		});
	});
	
    client.on('disconnect', function() {
        console.log('client - disconnect');
    });
});
//--------------------------------

//Start the whole thing
server.listen(port);