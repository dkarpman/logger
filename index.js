/**
 * Module dependencies.
 */

const Promise = require('bluebird') ;
const crypto  = require('crypto')

var Counter = require('passthrough-counter');
var humanize = require('humanize-number');
var bytes = require('bytes');

/**
 * Expose logger.
 */

module.exports = dev;

/**
 * Development logger.
 */

function dev(opts) {
  return function *logger(next) {
    // request
    var start = new Date ;

    const log_id = this.hasOwnProperty('request') && this.request.header && this.request.header['x-unique-id']
                   ? this.request.header['x-unique-id']
                   : crypto.randomBytes(8).toString('hex') ;

    this.log_id = log_id ;
    this.log = function() {
      let args = Array.prototype.slice.call(arguments);
      const the_time = new Date();
      args.unshift((Number(the_time) - Number(start)) + 'ms')
      args.unshift(the_time) ;
      args.unshift(log_id);
      console.log.apply(console, args);
    }
    this.error = function() {
      let args = Array.prototype.slice.call(arguments);
      const the_time = new Date();
      args.unshift((Number(the_time) - Number(start)) + 'ms')
      args.unshift(new Date()) ;
      args.unshift(log_id);
      console.error.apply(console, args);
    }

    this.log( 'BEG'
            , this.hasOwnProperty('request') && this.request.hasOwnProperty('ip') ? this.request.ip : '127.0.0.1'
            , '"' + (this.hasOwnProperty('request') && this.request['header'] && this.request.header['user-agent'] ? this.request.header['user-agent'] : '-') + '"'
            , '"' + this.method
            , this.originalUrl
            , 'HTTP/' + this.req.httpVersionMajor + '.' + this.req.httpVersionMinor + '"' );

    try {
      yield next;
    } catch (err) {
      // log uncaught downstream errors
      log(this, start, null, err);
      throw err;
    }

    // calculate the length of a streaming response
    // by intercepting the stream with a counter.
    // only necessary if a content-length header is currently not set.
    var length = this.response.length;
    var body = this.body;
    var counter;
    if (null == length && body && body.readable) {
      this.body = body
        .pipe(counter = Counter())
        .on('error', this.onerror);
    }

    // log when the response is finished or closed,
    // whichever happens first.
    var ctx = this;
    var res = this.res;

    var onfinish = done.bind(null, 'finish');
    var onclose = done.bind(null, 'close');

    res.once('finish', onfinish);
    res.once('close', onclose);

    function done(event) {
      res.removeListener('finish', onfinish);
      res.removeListener('close', onclose);
      log(ctx, start, counter ? counter.length : length, null, event);
    }
  }
}

/**
 * Log helper.
 */

function log(ctx, start, len, err, event) {
  // get the status code of the response
  var status = err
    ? (err.status || 500)
    : (ctx.status || 404);

  // set the color of the status code;
  var s = status / 100 | 0;

  // get the human readable response length
  var length;
  if (~[204, 205, 304].indexOf(status)) {
    length = '';
  } else if (null == len) {
    length = '-';
  } else {
    length = len // bytes(len);
  }

  ctx.log('FIN'
         , ctx.hasOwnProperty('request') && ctx.request.hasOwnProperty('ip') ? ctx.request.ip : '127.0.0.1'
         , '"' + (ctx.hasOwnProperty('request') && ctx.request.hasOwnProperty('header') && ctx.request.header.hasOwnProperty('user-agent') ? ctx.request.header['user-agent'] : '-') + '"'
         , '"' + ctx.method
         , ctx.originalUrl
         , 'HTTP/' + ctx.req.httpVersionMajor + '.' + ctx.req.httpVersionMinor + '"'
         , status
         , length ) ;
}
