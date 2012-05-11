$(function() {
    var socket = io.connect();
	
	// Server methodes
	//----------------------------------------
	
	socket.on('updateContent', function(msg) {
		document.getElementById('wikiwayContent').innerHTML = msg;
	});
	
	socket.on('jGrowl', function(msg, type) {
		var header = '';
		var image = '';
		switch(type){
			// system message
			case 0:
				header = 'Systemmeldung';
				image = 'systemmessage.png';
				break;
			// system error
			case 1:
				header = 'Systemfehler';
				break;
			// game info
			case 2:
				header = 'Spielinfo';
				break;				
		}
		jGrowlTheme('mono', header, msg, "./img/" + image);
	});
	
	// Userinput methodes
	//----------------------------------------
	
	//Init when loadad the first time
	$(document).ready(function() {
		socket.emit('init');
	});
});
