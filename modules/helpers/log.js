/*
*	wikiway
*	Authors: Andrin Schnegg (andrin[at]schnegg.biz),
*			 Sebastian Widmer (widmer.sebastian[at]gmail.com)
*	Version: Experimental
*	Datum:   07.09.2012
*/
//Coloring Console
var colors = require('colors');

//Constants for Loglevel
exports.INFO 	= 1;
exports.WARN 	= 2;
exports.ERROR 	= 3;
exports.SUCCESS = 4;

exports.log = function (text, loglevel) {
	//Set loglevel if not set
	if (!loglevel) loglevel = 1;
	//Build String for output
	var output,
		d = new Date();
	//Loglevel
	if (loglevel == 1) output = 'I|';
	if (loglevel == 2) output = 'W|';
	if (loglevel == 3) output = 'E|';
	if (loglevel == 4) output = 'I|';
	//Custom Date String
	output = output +
		d.getFullYear() +
		'-' + pad(d.getMonth(), 2) +
		'-' + pad(d.getDate(), 2) +
		'|' + pad(d.getHours(), 2) +
		':' + pad(d.getMinutes(), 2) +
		':' + pad(d.getMilliseconds(), 3);
	//Logtext
	output = output + '|' + text;
	//output in nice colors :)
	if (loglevel == 1) output = console.log(output);
	if (loglevel == 2) output = console.log(output.yellow);
	if (loglevel == 3) output = console.log(output.red);
	if (loglevel == 4) output = console.log(output.green);
}

//Insert Leading Zeros
function pad(number, length) { return (number+"").length >= length ? number + "" : pad("0" + number, length)};