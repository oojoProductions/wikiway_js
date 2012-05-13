$(document).ready(function() {
    var socket = io.connect();
	
	// Server methodes
	//----------------------------------------
	
	socket.on('updateContent', function(data) {
		document.getElementById('wikiwayContent').innerHTML = data;
		
		// Userinput methodes
		//----------------------------------------
		$("a").click(function(e){
			e.preventDefault();
			switch($(this).attr("action")){
				//List Games
				case "listGames":
					socket.emit('listGames');
					break;
				//Enter Game
				case "joinGame":
					socket.emit('joinGame', $(this).attr("game"));
					break;
				//New Game
				case "newGame":
					socket.emit('newGame');
					break;
				case "next":
					socket.emit('next', $(this).attr("art"))
			}
		});
		//Get Control over Submitbutton
		$("form").submit(function () {
			socket.emit('newGame', $('#text-startArticle').val(), $('#text-endArticle').val());
			return false;
		});
		
	});
	
	socket.on('growl', function(msg, type) {
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
				image = 'systemmessage.png';
				break;				
		}
		jGrowlTheme('mono', header, msg, "./img/" + image);
	});
	
	//Init when loaded the first time
	socket.emit('init');
});



