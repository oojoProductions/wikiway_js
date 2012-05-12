/*
*	wikiway
*	Authors: Andrin Schnegg (andrin[at]schnegg.biz),
*			 Sebastian Widmer (widmer.sebastian[at]gmail.com)
*	Version: Experimental
*	Datum:   11.05.2012
*/

//Includes
var express = require('express');
var socketio = require('socket.io');
//Filesystem
var fs = require('fs');
//Include Main Game Functions
var game = require('./game.js');
//Imclude template functions
var templ = require('./templ.js');

//Port for Game
var port = 1337;

//Define Server
var server = express.createServer();
var io = socketio.listen(server);
//Serve files in public/ folder
server.use(express.static(__dirname + '/public'));

//Array with open Games
//var games = new Array();

//Socket IO logic
//--------------------------------
io.sockets.on('connection', function(client) {
	//Client loads Webpage
	client.on('init', function() {
        //Write new Game template
		templ.render('newGame', 'utf8', function (data){
			client.emit('updateContent', data);
		});
		
		client.emit('jGrowl', 'Hallo Welt!', 0);
    });

    client.on('disconnect', function() {
        console.log('disconnect');
    });
});
//--------------------------------

//Start the whole thing
server.listen(port);