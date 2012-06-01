$(document).ready(function() {
	var socket = io.connect();
	
	// Server methodes
	//----------------------------------------
	
	//The server function to switch the html code of content div
	socket.on('updateContent', function(data) {
		$('#wikiwayContent').html(data);
		$('html, body').scrollTop('0');
		initUserInputs();
	});
	
	socket.on('updateUserPositions', function(data) {
		$('#wikiwayUsers').html(data);
	});
	
	socket.on('chatReceiver', function(username, message) {
		$('#wikiwayChatContent').prepend('<b>'+username+':</b> '+message+'<br />');
	});	
	
	//Chat function
	
	//Get Control over Submitbutton
	$("#ChatButton").click(function(){
		if($('#text-username').val() != ""){
			socket.emit('chatSender', $('#ChatText').val());
		}
	});

	//Get control over the enter key on the keyboard
	$('#ChatText').keypress(function(e){
		if(e.which == 13){
			$("#ChatButton").click();
		}
	});
	
	
	
	//The server function to get the username frome user (block the ui, show a username form)
	socket.on('getUsername', function(form) {
		$.blockUI({ message: form });
		//Get Control over Submitbutton
		$("#getUsernameButton").click(function(){
			//Clientside validation, just growl a message if its not ok
			if($('#text-username').val() != ""){
				socket.emit('setUsername', $('#text-username').val());
			}else{
				growl('Bitte Username eingeben!', 1);
			}
		});
		
		//Get control over the enter key on the keyboard
		$('#text-username').keypress(function(e){
			if(e.which == 13){
				$("#getUsernameButton").click();
			}
		});
	});
	
	//The server function to unblock the username set form
	socket.on('hideSetUsername', function() {
		$.unblockUI(); 
	});
	
	function initUserInputs(){
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
				case "startGame":
					socket.emit('startGame', $(this).attr("game"));
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
					socket.emit('next', $(this).attr("art"));
					break;
			}
		});
		
		//Get Control over Submitbutton
		$("#newGameButton").click(function(){
			//Clientside validation, just growl a message if its not ok
			if($('#text-startArticle').val() != "" & $('#text-endArticle').val() != ""){
				socket.emit('newGame', $('#text-startArticle').val(), $('#text-endArticle').val());
			}else{
				growl('Bitte Start- und Endartikel eingeben!', 1);
			}
		});
		
		//Get control over the enter key on the keyboard
		$('#newGame').keypress(function(e){
			if(e.which == 13){
				$("#newGameButton").click();
			}
		});
		
		//Autocomplete new article form, start article
		$('#text-startArticle').autocomplete({
			serviceUrl:'http://api.schnegg.biz/wikiapi/search.php'
		});
		
		//Autocomplete new article form, end article
		$('#text-endArticle').autocomplete({
			serviceUrl:'http://api.schnegg.biz/wikiapi/search.php'
		});		
	};
	
	//Client growlfunction
	socket.on('growl', function(msg, type) {
		growl(msg, type);
	});
	
	//Get control over the f5 key on the keyboard to refresh the page
	$(document).keydown(function(event) {
		if(event.keyCode == 116){
			event.preventDefault();
			growl('Seite erneuert!', 1);
			socket.emit('refresh');
		}
	});	
	
	//Init when loaded the first time
	socket.emit('init');
	
	//Private growl function
	function growl(msg, type) {
		var header = '';
		var image = '';
		switch(type){
			// system message
			case 0:
				header = 'Information';
				image = 'information.png';
				break;
			// system error
			case 1:
				header = 'Systemfehler';
				image = 'systemfail.png';
				break;
			// game info
			case 2:
				header = 'Spielinfo';
				image = 'information.png';
				break;				
		}
		$.jGrowl(msg, {
                header: '<img class="jGrowlImage" src="./img/' + image + '" />'+header
        });	
	}
});



