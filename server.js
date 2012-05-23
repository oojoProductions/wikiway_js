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
//Extension for Object Prototype, now its possible to waatch changes in an object
require('./modules/object_watch').init();
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
			game.next(client, null, function(started, win, gameId, args){
				if (started == false)
				{
					templ.render('waitingroom', {game: args.game, players: args.players, gameId: gameId}, function(data) {
						client.emit('updateContent', data);
					});
				}
				else
				{
					client.emit('updateContent', args.bodycontent);
				}
			});
			templ.render('listGames', {games: game.listGames()}, function (data){
				//Update all clients in listGames
				io.sockets.in('listGames').emit('updateContent', data);
			});
		});
	});

	//Client can start game
	client.on('startGame', function(gameId) {
		if (gameId == null) return;
		//start game
		game.startGame(gameId);
		//Get all clients in gamechannel
		var clientsInGame = io.sockets.clients(gameId);
		//loop through all clients and update their content
		for (i in clientsInGame)
		{
			//define anonym function and call it to keep client object even in a loop with asynchronus functions
			//seriously - WTF???
			(function(client) {
				game.next(client, null, function(started, win, gameId, args) {
					client.emit('updateContent', args.bodycontent);
				});
			}(clientsInGame[i]));
		}
	});

	//Next article
	client.on('next', function(articleId) {
		game.next(client, articleId, function(started, win, gameId, args){
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
				client.emit('updateContent', args['bodycontent']);
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
//Server Broadcast a message or data. args: client, msg, msgType, channel, template, locals
exports.broadcast = function(args) {
	//Message
	if (typeof args.msg != 'undefined')
	{
		if (typeof args.msgType == 'undefined') args.msgType = 2;
		if (typeof args.client == 'undefined')
		{
			if (typeof args.channel == 'undefined')
			{
				io.sockets.emit('growl', args.msg, args.MsgType);
			}
			else
			{
				io.sockets.in(args.channel).emit('growl', args.msg, args.MsgType);
			}
		}
		else
		{
			if (typeof args.channel == 'undefined')
			{
				args.client.broadcast.emit('growl', args.msg, args.MsgType);
			}
			else
			{
				args.client.broadcast.in(args.channel).emit('growl', args.msg, args.MsgType);
			}
		}
	}
	//Template
	if (typeof args.template != 'undefined' && typeof args.locals != 'undefined')
	{
		templ.render(args.template, args.locals, function (data){
			if (typeof args.client == 'undefined')
			{
				if (typeof args.channel == 'undefined')
				{
					io.sockets.emit('updateContent', data);
				}
				else
				{
					io.sockets.in(args.channel).emit('updateContent', data);
				}
			}
			else
			{
				if (typeof args.channel == 'undefined')
				{
					args.client.broadcast.emit('updateContent', data);
				}
				else
				{
					args.client.broadcast.in(args.channel).emit('updateContent', data);
				}
			}
		});
	}	
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
				client.emit('updateContent', args.bodycontent);
			});
			
			console.log('------- renderUserInfo------');
			renderUserInfo(client, function(html){
				client.emit('updateUserInfo', html);
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

function renderUserInfo(client, callback){
	var clients = new Array();
	client.get('game', function(err, gameObject){
		//Get all clients in gamechannel
		var clientsInGame = io.sockets.clients(gameObject.id);
		var startArticle = gameObject.startArticle;
		var endArticle = gameObject.endArticle;
	
		//loop through all clients and update their content
		for (i in clientsInGame)
		{
			//define anonym function and call it to keep client object even in a loop with asynchronus functions
			(function(client) {
				client.get('username', function(err, username){
					client.get('game', function(err, gameObject){
						var history = gameObject.history;
						clients.push(new Array(username, history[history.length-1]));
						//If user is not in game serve list of games
						templ.render('userInfos', {clients: clients, startArticle: startArticle, endArticle: endArticle}, function (data){
							callback(data);
						});						
					});
				});
			}(clientsInGame[i]));
		}
	});
}

//Start the whole thing
server.listen(port);
console.log('server - started on port '+port);