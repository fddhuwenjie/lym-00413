function cjsGreet(name) {
  return 'Hello, ' + name + '!';
}

function cjsShout(str) {
  return str.toUpperCase() + '!!!';
}

function cjsWhisper(str) {
  return str.toLowerCase() + '...';
}

function cjsRepeat(str, n) {
  var result = '';
  for (var i = 0; i < n; i++) {
    result += str;
  }
  return result;
}

function cjsReverse(str) {
  return str.split('').reverse().join('');
}

module.exports = {
  greet: cjsGreet,
  shout: cjsShout,
  whisper: cjsWhisper,
  repeat: cjsRepeat,
  reverse: cjsReverse,
};
