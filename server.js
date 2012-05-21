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

//Port for Development
var port = 1337;
//First to args are path to node and to script
var arguments = process.argv.splice(2);
//Get port from commandline if set
if (arguments.length && !(isNaN(arguments[0])))
{
	port = arguments[0];
}

//Define Server
var server = express.createServer();
var io = socketio.listen(server);
//Less log messages from socket.io
io.set('log level', 1);
//Serve files in public/ folder
server.use(express.static(__dirname + '/public'));
//Serve index
server.get('/', function(req, res){
	//Render index
	templ.render('index', null, function (data){
		res.send(data);
	});
});


//Socket IO logic
//--------------------------------
//Save how many clients are connected
var clientCount = 0;
//On connection
io.sockets.on('connection', function(client) {
	//+1 client
	++clientCount;
	//log
	console.log('client - connected');
	//Client loads Webpage
	client.on('init', function() {
		console.log('client - init from browser');
		// refresh
		refresh(client);
		
		//show welcome message
		client.emit('growl', "Willkommen! "+clientCount+ " Spieler verbunden.", 0);
		
		// ask user for name
		templ.render('getUsername', null, function (data){
			client.emit('getUsername', data);
		});
    });
	
	//List all Games
	client.on('listGames', function() {
		templ.render('listGames', {games: game.listGames(client)}, function (data){
			client.emit('updateContent', data);
		});
	});
	
	//Client creates new game or show form if start and endarticle == null
	client.on('newGame', function(startArticle, endArticle) {
		game.newGame(startArticle, endArticle, client, function(success){
			if (success)
			{
				templ.render('listGames', {games: game.listGames(client)}, function (data){
					//Update all clients in listGames
					io.sockets.in('listGames').emit('updateContent', data);
					//Output message new game created
					io.sockets.in('listGames').emit('growl', 'Neues Spiel erstellt!',0);
				});
			}
			else
			{
				templ.render('newGame', null, function (data){
					client.emit('updateContent', data);
				});
			}		
		});
	});
	
	//Client joins game
	client.on('joinGame', function(gameId) {
		game.joinGame(client, gameId, function(){
			//Goto first article
			game.next(client, null, function(win, bodycontent, gameId, args){
				client.emit('updateContent', bodycontent);
			});
			templ.render('listGames', {games: game.listGames(client)}, function (data){
				//Update all clients in listGames
				io.sockets.in('listGames').emit('updateContent', data);
			});
		});
	});
	
	//Next article
	client.on('next', function(articleId) {
		console.log('client - next article');
		game.next(client, articleId, function(win, bodycontent, gameId, args){
			if (win)
			{
				//Get history from optional args array
				history = args['history'];
				//Get username from optional args array
				username = args['username'];
				templ.render('win', {history: history}, function (data){
					client.emit('updateContent', data);
					//Render lose template
					templ.render('lose', {history: history, winner: username}, function (data){
						client.broadcast.in(gameId).emit('updateContent', data);
						var clientsInGame = io.sockets.clients(gameId);
						for (i in clientsInGame)
						{
							game.leaveGame(clientsInGame[i]);
						}
					});
				});

			}
			else
			{
				client.emit('updateContent', bodycontent);
			}
		});
	});
	//User can Set his name
	client.on('setUsername', function(name){
		client.set('username', name, function(){
			client.emit('hideSetUsername');
			client.emit('growl', 'Dein Username: '+name, 0);
			client.get('username', function(err, username){
				console.log("server - set username: "+username);
			});
		});
	});
	
	//User can refresh the page
	client.on('refresh', function() {
		refresh(client);
	});
	
    client.on('disconnect', function() {
		//-1 client
		--clientCount;
		//Client should leave Game
		game.leaveGame(client);
		//log
        console.log('client - disconnected');
    });
});

//Server Broadcast a message for all users
exports.broadcastMsgAll = function (client, msg) {
	client.emit('growl', msg, 2);
};
//Server Broadcast a message for users in game
exports.broadcastMsgGame = function (client, gameId, msg) {
	client.broadcast.in(gameId).emit('growl', msg, 2);
};
//Server Broadcast content for all users
exports.broadcastContentAll = function (client, template, locals) {
	templ.render(template, null, function (data){
		client.broadcast.emit('updateContent', data);
	});
};
//Server Broadcast content for users in game
exports.broadcastContentGame = function (client, gameId, template, locals) {
	templ.render(template, null, function (data){
		client.broadcast.in(gameId).emit('updateContent', data);
	});
};
//--------------------------------

//private functions
//----------------------------------
function refresh(client){
	//Check if user is in game
	game.inGame(client, function (inGame){
		if (inGame)
		{
			//If user is in game serve last article
			game.next(client, null, function(win, bodycontent, gameId, args){
				client.emit('updateContent', bodycontent);
			});
		}
		else
		{
			//If user is not in game serve list of games
			templ.render('listGames', {games: game.listGames(client)}, function (data){
				client.emit('updateContent', data);
			});
		}
	});
};

//Start the whole thing
server.listen(port);
console.log('server - started on port '+port);