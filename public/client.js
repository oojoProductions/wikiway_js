$(function() {
    var socket = io.connect();
	
	//socket.emit('updateContent');
	socket.emit('startgame', '');

	socket.on('disconnect', function(){
		console.log('disconnect');
	});
		
	socket.on('updateContent', function(msg) {
		document.getElementById('wikiwaycontent').innerHTML = msg;
	});
	
	socket.on('jqinit', function() {
		$("a").click(function(e){
			e.preventDefault();
			var page = $(this).attr("load");
			socket.emit('startgame', page);
		});
	});
	
	socket.on('updateInfobar', function(html) {
		document.getElementById('infobar').innerHTML = html;
	});
		
	$('#chatbutton').click(function() {
		var message = $('#message');
		socket.emit('chat', message.val());
		message.attr('value', '');
	});
	
	socket.on('chat', function(msg) {
		$.jGrowl(msg);
		//document.getElementById('chatText').innerHTML += '<p>'+msg+'</p>';
	});

});