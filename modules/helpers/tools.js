/*
*	wikiway
*	Authors: Andrin Schnegg (andrin[at]schnegg.biz),
*			 Sebastian Widmer (widmer.sebastian[at]gmail.com)
*	Version: Experimental
*	Datum:   22.05.2012
*/
exports.uriEncode = function (unencoded) {
	if (unencoded == null) return null;
	return encodeURIComponent(unencoded.replace(/ /g,'_'));
}

exports.uriDecode = function (encoded) {
	if (encoded == null) return null;
	return decodeURIComponent(encoded.replace(/_/g, ' '));
}

exports.escape = function(unescaped) {
	if (unescaped == null) return null;
	return unescaped.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
};