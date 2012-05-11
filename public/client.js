$(function() {
    var socket = io.connect();
	
	//Init when loadad the first time
	$(document).ready(function() {
		socket.emit('init');
	});
	
	socket.on('updateContent', function(msg) {
		document.getElementById('content').innerHTML = msg;
	});
	
});