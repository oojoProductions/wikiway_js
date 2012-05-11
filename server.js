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
        //Write the Content
		client.emit('updateContent', "Hallo Welt!");
    });

    client.on('disconnect', function() {
        console.log('disconnect');
    });
});
//--------------------------------

//Start the whole thing
server.listen(port);