#!/usr/bin/env node

var async = require('async');
var http = require('http');
var Twitter = require('twitter');
var nodemailer = require("nodemailer");
var moment = require("moment");
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

if (process.env.TICKERS == null) {
   log.error("ERROR: no tickers specified in environment variable TICKERS - Exiting...");
   process.exit(1);
}

if (process.env.CRON_EXPRESSION == null) {
   log.error("ERROR: no cron expression specified in environment variable CRON_EXPRESSION - Exiting...");
   process.exit(1);
}

if (process.env.MAIL_PROVIDER == null) {
   log.error("ERROR: no mail provider specified in environment variable MAIL_PROVIDER - Exiting...");
   process.exit(1);
}

if (process.env.MAIL_USER == null) {
   log.error("ERROR: no mail user specified in environment variable MAIL_USER - Exiting...");
   process.exit(1);
}

if (process.env.MAIL_PASSWORD == null) {
   log.error("ERROR: no mail password specified in environment variable MAIL_PASSWORD - Exiting...");
   process.exit(1);
}

if (process.env.MAIL_RECIPIENTS == null) {
   log.error("ERROR: no mail recipients specified in environment variable MAIL_RECIPIENTS - Exiting...");
   process.exit(1);
}

var tickers = process.env.TICKERS.split(',');
var cronExpression = process.env.CRON_EXPRESSION;
var mailProvider = process.env.MAIL_PROVIDER;
var mailUser = process.env.MAIL_USER;
var mailPassword = process.env.MAIL_PASSWORD;
var mailRecipients = process.env.MAIL_RECIPIENTS;

var me = schedule.scheduleJob(cronExpression, function(){
  log.info("Executing stock script");
  log.info("Tickers = "+tickers);
  var resultMail = "";
  async.each(tickers, function(ticker, callback) {
    async.parallel([
    function(callback) {
      getTickerPrice(ticker, function(err, currentPrice) {
        log.debug("Got price for company "+currentPrice.company+" equal to "+currentPrice.price);
        callback(null, currentPrice);
      });
    //},
    //function(callback) {
      //getTickerTweets(ticker, function(err, tweets) {
      //  log.debug("Got these tweets for company "+ticker+": "+tweets); 
        //callback(null, tweets);
      //});
    //},
    }],
    
    function(err, result) {
      if (err) {
        log.error(err);
        return next(err);
      }
      log.debug("Finished processing ticker "+ticker);
      // TODO: save data in mongo
      resultMail = resultMail+"<p>";
        resultMail = resultMail+"<h2>" +result[0].ticker.replace(/"/g, '')+ " - " +result[0].company.replace(/"/g, '')+ "</h2>";
        resultMail = resultMail+"<ul>";
          resultMail = resultMail+"<li><strong>Price: "+result[0].price+ "</strong></li>";
        resultMail = resultMail+"</ul>";
      resultMail = resultMail+"</p>";
      log.trace("resultMail = "+resultMail);
      callback(null);
    }); 
  },

  function(err) {
    if (err) {
      log.error(err);
      return next(err);    
    }
    log.debug("Finished processing tickers, sending mail with this result: "+resultMail);
    sendMail(resultMail, function(err) {
      callback(null);
    });
  });
}); 

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
      var parsed = body.split('",');
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
    }
    callback(null, tweets);
  }); 
}

function sendMail(resultMail, callback) {
  log.trace("Sending mail with this HTML body: "+resultMail);
//  var smtpTransport = new nodemailer.createTransport({
    //service: mailProvider,
//    
//    auth: {
//      user: mailUser,
//      pass: mailPassword 
//    }
//  });
var smtpTransport = new nodemailer.createTransport();

  smtpTransport.sendMail({
    from: "Stock Mail <" + mailUser + ">",
    to: mailRecipients,
    subject: "Stock Mail - " + moment(new Date()).format('YYYY-MM-DD'),
    html: resultMail,
    generateTextFromHTML: true
  }, function(err, response) {
    if(err) {
      log.error(err);
    }
    log.info("Mail sent: " + response.message);
  });
}
