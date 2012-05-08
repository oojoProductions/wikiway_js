var express = require('express');
var socketio = require('socket.io');
var request = require('request');
var crypto = require('crypto');

// includes
//var test = require('./models/game.js');

//Für Cloud9
var port = process.env.C9_PORT;
//Für Lokale installation
//var port = 1337;
console.log('System started on Port: ' + port);

var server = express.createServer();
var io = socketio.listen(server);

var games = new Array();



server.get('/', function (req, res) {
  res.sendfile(__dirname + '/public/index.html');
});

server.use(express.static(__dirname + '/public'));

io.sockets.on('connection', function(client) {
	var current_date = (new Date()).valueOf().toString();
	var random = Math.random().toString();
	client.sessionId = crypto.createHash('sha1').update(current_date + random).digest('hex');
	client.links = new Array();
	
	console.log('-------------------');
	console.log('Neuer Spieler, ID: '+client.sessionId);
	console.log('-------------------');
	
	client.on('createGame', function( startArticle, endArticle ){
		request("http://de.wikipedia.org/wiki/"+startArticle, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				request("http://de.wikipedia.org/wiki/"+endArticle, function (error, response, body) {
					if (!error && response.statusCode == 200) {
						
						// create game
						var gameObject = new Object();
						var current_date = (new Date()).valueOf().toString();
						var random = Math.random().toString();
						gameObject.id = crypto.createHash('sha1').update(current_date + random).digest('hex');						
						gameObject.admin = client.sessionId;
						gameObject.startArticle = startArticle;
						gameObject.endArticle = endArticle;
						gameObject.created = new Date().getTime();
						gameObject.started = false;
						games.push(gameObject);
						
						// join game
						client.join(gameObject.id);
						client.gameID = gameObject.id;
					}
				});
			}
		});
	});
	
	client.on('joinGame', function(gameArrID) {
		if( typeof games[gameArrID] != "undefined" && games[gameArrID].started == false ){
			gameObject = games[gameArrID];
			
			// join game
			client.join(gameObject.id);
			client.gameID = gameObject.id;
		}
		
		// update Client
		client.emit('updateContent');
	});
	
	client.on('updateContent', function() {
		console.log(client.gameID);
		if( typeof client.gameID == "undefined" | client.gameID == ''){
			var serverlist = 'keine Server gefunden';
			for(var i=0; i<games.length; i++) {
				serverlist = serverlist + '<li>von '+ games[i].startArticle + ' nach ' + games[i].endArticle + '</li>';
			}
			var bodycontent = '<h1>Serverliste:</h1><ul>'+serverlist+'</ul>';
			client.emit('updateContent', bodycontent);
			
			var bodyinfobar = '<p>neues Spiel erstellen</p>';
			client.emit('updateInfobar', bodyinfobar);
			
			client.emit('jqinit');		
		}else{
			return false;
		}
	});
	
    client.on('startgame', function(page) {
		if(page == ''){
			var url = '/wiki/Blindtext';
		}else{
			var urlHTML = client.links[page];
			var urlRegex = urlHTML.match("href=\"(.*?)\"");
			var url = urlRegex[1];
		}
		request("http://de.wikipedia.org"+url, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var regex = '<!-- bodyContent -->((.|\n|\r)*)<!-- /bodycontent -->';
				var bodycontent = body.match(regex);
				bodycontent = bodycontent[1];
				var linkRegex = new RegExp('<a href="/wiki/(.*?)".*?>(.*?)</a>',"g");

				client.links = bodycontent.match(linkRegex, "g");

				for(var i=0; i<client.links.length; i++) {
					var value = client.links[i];
					var url = value.match("href=\"(.*?)\"");
					bodycontent = bodycontent.replace(url[1], "#\" load=\""+i);
				}
				
				// remove edit links
				var editRegex = new RegExp('<span class="editsection">.*?</span>',"g");
				var edits = bodycontent.match(editRegex, "g");
				for(var i=0; i<edits.length; i++) {
					edit = edits[i];
					bodycontent = bodycontent.replace(edit, "");
				}
				
				// remove all external links
				var extlinkRegex = new RegExp('<a.*?href=".*?</a>',"g");
				var extlinks = bodycontent.match(extlinkRegex, "g");
				for(var i=0; i<extlinks.length; i++) {
					var extlink = extlinks[i];
					console.log(extlink);
					if(!extlink.match('.*?href=".*?".*?load=.*?|.*?class="image".*?|.*?href="#.*?')){
						var text = extlink.match(">(.*?)<");
						bodycontent = bodycontent.replace(extlink, text[1]);
					}
				}
				
			}else{
				client.emit('chat', 'Diese Seite ist nicht verf&auml;gbar.');
			}
			client.emit('updateContent', bodycontent);
			client.emit('jqinit');
			client.emit('updateInfobar', "dabebei");
		});
    });
		
	client.on('chat', function(msg) {
		client.broadcast.emit('chat', msg);
		client.emit('chat', msg);
	});		
		
    client.on('disconnect', function() {
        console.log('disconnect');
    });
});

server.listen(port);