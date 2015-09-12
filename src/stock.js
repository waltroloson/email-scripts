#!/usr/bin/env node

var async = require('async');
var http = require('http');
var Twitter = require('twitter');
var schedule = require('node-schedule');
var bunyan = require('bunyan');
var bunyanDebugStream = require('bunyan-debug-stream');
var log = bunyan.createLogger({
	name: 'stock - '+__filename+' ',
	streams: [{
		level: 'trace',
		type: 'raw',
		stream: bunyanDebugStream({
			basepath: __dirname
		})
	}],
	serializers: bunyanDebugStream.serializers
});

var tickers = process.env.TICKERS.split(',');
var cronExpression = process.env.CRON_EXPRESSION;

if (tickers == null) {
   log.error("ERROR: no tickers specified in environment variable TICKERS - Exiting...");
   process.exit(1);
}

if (cronExpression == null) {
   log.error("ERROR: no cron expression specified in environment variable CRON_EXPRESSION - Exiting...");
   process.exit(1);
}

//var me = schedule.scheduleJob(cronExpression, function(){
  log.info("Executing stock script");
  log.info("Tickers = "+tickers);
  async.each(tickers, function(ticker, callback) {
    async.waterfall([
    function(callback) {
      getTickerPrice(ticker, function(err, currentPrice) {
        log.debug("Got price for company "+currentPrice.company+" equal to "+currentPrice.price);
      });
      getTickerTweets(ticker, function(err, tweets) {
        log.debug("Got these tweets for company "+ticker+": "+tweets); 
      });
    }],
    
    function(err, result) {
        if (err) {
          log.error(err);
          return next(err);
        }
        callback(null);
      });
    }, 

    function(err) {
    if (err) {
      log.error(err);
      return next(err);    
    }
  }); 
//}); 

function getTickerPrice(ticker,callback) {
  return http.get({
    host: 'download.finance.yahoo.com',
    path: '/d/quotes.csv?f=nsl1&s='+ticker
  }, function(response) {
    var body = '';
    response.on('data', function(d) {
      body += d;
    });
    response.on('end', function() {
      var parsed = body.split(',');
      callback(null,{
        company: parsed[0],
        ticker: parsed[1],
        price: parsed[2]
      });
    });
  }); 
}

function getTickerTweets(ticker, callback) {
  var client = new Twitter();
  return client.get('/search/tweets', function (err, tweets, response) {
    if (err) {
      log.error(err);
      throw err;
    }
    callback(null, tweets);
  }); 
}
