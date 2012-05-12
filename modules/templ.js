/*
*	wikiway
*	Authors: Andrin Schnegg (andrin[at]schnegg.biz),
*			 Sebastian Widmer (widmer.sebastian[at]gmail.com)
*	Version: Experimental
*	Datum:   12.05.2012
*/
//Use Jade and node.js Filesystem
var jade = require('jade'),
	fs 	= require('fs');

//Render stuff
exports.render = function(file, locals, callback){
	//Make nice filepath
	file = './views/'+file+'.jade';
	
	//Read file async
	fs.readFile(file, 'utf8', function (err, data){
		//throw error
		if (err) throw err;
		//Compile template
		layout = jade.compile(data, { filename: file });
		//Call callback with compiled layout
		if (callback != null){
			callback(layout(locals));
		};
	});
};