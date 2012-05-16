$(document).ready(function() {
	var socket = io.connect();
	
	// Server methodes
	//----------------------------------------
	
	socket.on('updateContent', function(data) {
		document.getElementById('wikiwayContent').innerHTML = data;
		initUserInputs();
	});
	
	socket.on('getUsername', function(form) {
		$.blockUI({ message: form });
		//Get Control over Submitbutton
		$("#getUsernameButton").click(function(){
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
		
		//Autocomplete new article form
		$('#text-startArticle').autocomplete({
			serviceUrl:'http://api.schnegg.biz/wikiapi/search.php'
		});
		
		//Autocomplete new article form
		$('#text-endArticle').autocomplete({
			serviceUrl:'http://api.schnegg.biz/wikiapi/search.php'
		});		
	};
	
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



