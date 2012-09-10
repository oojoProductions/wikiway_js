/*
*	wikiway
*	Authors: Andrin Schnegg (andrin[at]schnegg.biz),
*			 Sebastian Widmer (widmer.sebastian[at]gmail.com)
*	Version: Experimental
*	Datum:   11.05.2012
*/

//wikiway uses express and socket.io
var express = require('express');
//Extension for Object Prototype, now its possible to waatch changes in an object
require('./modules/object_watch').init();
//Include main game functions
var game = require('./modules/game.js');
//Include template functions and tools
var templ = require('./modules/templ.js'),
	tools = require('./modules/tools.js'),
	l = require('./modules/log.js');

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
var app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server);

server.listen(port);
//Less log messages from socket.io
io.set('log level', 1);
//Serve files in public/ folder
app.use(express.static(__dirname + '/public'));
//Serve index
app.get('/', function(req, res){
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
	l.log('client - connected', l.SUCCESS);
	//Client loads Webpage
	client.on('init', function() {
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
		//clear Footer
		clearFooter();
		//Update footer title
		updateFooterWikiwayTitle(client, function(data) {client.emit('updateFooterWikiwayTitle',data)});

		templ.render('listGames', {games: game.listGames(client)}, function (data){
			client.emit('updateContent', data);
		});
	});
	
	//Client creates new game or show form if start and endarticle == null
	client.on('newGame', function(startArticle, endArticle) {
		//Escape Input
		startArticle = tools.escape(startArticle);
		endArticle = tools.escape(endArticle);
		//Create Game
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
			//Update footer title
			updateFooterWikiwayTitle(client, function(data) {client.emit('updateFooterWikiwayTitle',data)});
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
	//Client leaves game
	client.on('leaveGame', function() {
		game.leaveGame(client, function() {
			//Update footer title
			updateFooterWikiwayTitle(client, function(data) {client.emit('updateFooterWikiwayTitle',data)});	
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
							game.freezeGame(clientsInGame[i]);
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
		//Escape Input
		name = tools.escape(name);
		//Set Username
		client.set('username', name, function(){
			client.emit('hideSetUsername');
			client.emit('growl', 'Dein Username: '+name, 0);
			client.get('username', function(err, username){
				l.log("server - set username: "+username);
			});
		});
	});
	
	//User can refresh the page
	client.on('refresh', function() {
		refresh(client);
	});
	
	//Chat
	client.on('chatSender', function(message) {
		//Escape Input
		message = tools.escape(message);
		//Check if user is in game
		game.inGame(client, function (inGame){
			if (inGame)
			{
				client.get('game', function(err, gameObject){
					var args = new Array();
					args.client = client;
					args.chatmessage = message;
					args.channel = gameObject.id;
					broadcast(args);
				});
			}
			else
			{
				var args = new Array();
				args.client = client;
				args.chatmessage = message;
				args.channel = 'listGames';
				broadcast(args);
			}
		});
	});	
	
	
    client.on('disconnect', function() {
		//-1 client
		--clientCount;
		//Client should leave Game
		game.leaveGame(client);
		//log
        l.log('client - disconnected', l.WARN);
    });
});
//Server Broadcast a message or data. args: client, msg, msgType, channel, template, locals, clientfunction, chatmessage
function broadcast(args) {
	//Chat
	if (typeof args.client != 'undefined' && typeof args.chatmessage != 'undefined' && typeof args.channel != 'undefined'){
		args.client.get('username', function(err, username){
			l.log('channel:'+args.channel);
			io.sockets.in(args.channel).emit('chatReceiver', username, args.chatmessage);
		});
	}
	

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
			if(typeof args.clientfunction == 'undefined'){
				args.clientfunction = 'updateContent';
			}else{
				args.clientfunction = args.clientfunction;
			}
			
			if (typeof args.client == 'undefined')
			{
				if (typeof args.channel == 'undefined')
				{
					io.sockets.emit(args.clientfunction, data);
				}
				else
				{
					io.sockets.in(args.channel).emit(args.clientfunction, data);
				}
			}
			else
			{
				if (typeof args.channel == 'undefined')
				{
					args.client.broadcast.emit(args.clientfunction, data);
				}
				else
				{
					args.client.broadcast.in(args.channel).emit(args.clientfunction, data);
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

			// update userlists
			client.get('game', function(err, gameObject){
				getUserPositions(gameObject.id, function(clients){
					var args = new Array();
					args.channel = gameObject.id;
					args.template = 'userInfos';
					args.clientfunction = 'updateUserPositions';
					var locals = new Array();
					locals.clients = clients;
					args.locals = locals;
					broadcast(args);
				});
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
	//Update footer title
	updateFooterWikiwayTitle(client, function(data) {client.emit('updateFooterWikiwayTitle',data)});
};

function clearFooter(){
	// update userlists with an empty clients array
	var args = new Array();
	args.channel = 'listGames';
	args.template = 'userInfos';
	args.clientfunction = 'updateUserPositions';
	var locals = new Array();
	locals.clients = new Array();
	args.locals = locals;
	broadcast(args);
}

function getUserPositions(channel, callback){
	var clients = new Array();
	//Get all clients in gamechannel
	var clientsInGame = io.sockets.clients(channel);
	var clientsInGameLength = clientsInGame.length;
	//loop through all clients and update their content
	for (i in clientsInGame){
		//define anonym function and call it to keep client object even in a loop with asynchronus functions
		(function(client) {
			client.get('username', function(err, username){
				client.get('game', function(err, gameObject){
					var history = gameObject.history;
					clients.push(new Array(username, history[history.length-1]));
					if(clients.length === clientsInGameLength){
						callback(clients);
					};
				});
			});
		}(clientsInGame[i]));
	}
}

function updateFooterWikiwayTitle (client, callback) {
	client.get('game', function(err, actGame) {
		templ.render('footerTitle', {actGame: actGame}, function (data){
			callback(data);
		});
	});
}

// public functions
exports.getUserPositions = function(channel, callback) {getUserPositions(channel, callback)};
exports.broadcast = function(args) {broadcast(args)};

l.log('server - started on port '+port, l.SUCCESS);

//ugly uncaught exeption handling
process.on('uncaughtException', function(err) {
  l.log('uncaught exeption', l.ERROR);
  console.log('--------------------------------------');
  console.log(err.stack);
  console.log('--------------------------------------');
});
