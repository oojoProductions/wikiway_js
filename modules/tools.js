/*
*	wikiway
*	Authors: Andrin Schnegg (andrin[at]schnegg.biz),
*			 Sebastian Widmer (widmer.sebastian[at]gmail.com)
*	Version: Experimental
*	Datum:   22.05.2012
*/
exports.uriEncode = function (unencoded) {
	return encodeURIComponent(unencoded.replace(/ /g,'_'));
}

exports.uriDecode = function (encoded) {
	return decodeURIComponent(encoded.replace(/_/g, ' '));
}

exports.escape = function(unescaped) {
	return unescaped.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
};