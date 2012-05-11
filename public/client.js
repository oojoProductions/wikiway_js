$(function() {
    var socket = io.connect();
	
	socket.on('updateContent', function(msg) {
		document.getElementById('wikiwaycontent').innerHTML = msg;
	});
	
});

//Init when loadad the first time
$(document).ready(function() {
	socket.emit('init');
});