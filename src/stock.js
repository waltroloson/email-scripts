#!/usr/bin/env node

var _ = require('underscore');
var async = require('async');
var http = require('http');
var Twitter = require('twitter');
var nodemailer = require("nodemailer");
var moment = require("moment");
var schedule = require('node-schedule');
var bunyan = require('bunyan');
var mongoose = require('mongoose');
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

if (process.env.TWITTER_CONSUMER_KEY == null) {
   log.error("ERROR: no mail recipients specified in environment variable TWITTER_CONSUMER_KEY - Exiting...");
   process.exit(1);
}

if (process.env.TWITTER_CONSUMER_SECRET == null) {
   log.error("ERROR: no mail recipients specified in environment variable TWITTER_CONSUMER_SECRET - Exiting...");
   process.exit(1);
}

if (process.env.TWITTER_ACCESS_TOKEN_KEY == null) {
   log.error("ERROR: no mail recipients specified in environment variable TWITTER_ACCESS_TOKEN_KEY - Exiting...");
   process.exit(1);
}

if (process.env.TWITTER_ACCESS_TOKEN_SECRET == null) {
   log.error("ERROR: no mail recipients specified in environment variable TWITTER_ACCESS_TOKEN_SECRET - Exiting...");
   process.exit(1);
}

if (process.env.TWITTER_ACCOUNTS == null) {
   log.error("ERROR: no tickers specified in environment variable TWITTER_ACCOUNTS - Exiting...");
   process.exit(1);
}

if (process.env.MONGODB_ADMIN_USER == null) {
   log.error("ERROR: no MongoDB admin user specified in environment variable MONGODB_ADMIN_USER - Exiting...");
   process.exit(1);
}

if (process.env.MONGODB_DATABASE == null) {
   log.error("ERROR: no MongoDB database name specified in environment variable MONGODB_DATABASE - Exiting...");
   process.exit(1);
}

if (process.env.MONGODB_ENV_MONGODB_PASS == null) {
   log.error("ERROR: Could not find a MongoDB container linked - Have you run this container with --link mongodb:mongodb option? - Exiting...");
   process.exit(1);
}

if (process.env.MONGODB_PORT_27017_TCP_PORT == null) {
   log.error("ERROR: Could not find a MongoDB container linked - Have you run this container with --link mongodb:mongodb option? - Exiting...");
   process.exit(1);
}

if (process.env.MONGODB_PORT_27017_TCP_ADDR == null) {
   log.error("ERROR: Could not find a MongoDB container linked - Have you run this container with --link mongodb:mongodb option? - Exiting...");
   process.exit(1);
}

var tickers = process.env.TICKERS.split(',');
var cronExpression = process.env.CRON_EXPRESSION;
var mailProvider = process.env.MAIL_PROVIDER;
var mailUser = process.env.MAIL_USER;
var mailPassword = process.env.MAIL_PASSWORD;
var mailRecipients = process.env.MAIL_RECIPIENTS;
var twitterConsumerKey = process.env.TWITTER_CONSUMER_KEY;
var twitterConsumerSecret = process.env.TWITTER_CONSUMER_SECRET;
var twitterAccessTokenKey = process.env.TWITTER_ACCESS_TOKEN_KEY;
var twitterAccessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
var twitterAccounts = process.env.TWITTER_ACCOUNTS.split(',');


var me = schedule.scheduleJob(cronExpression, function(){
  log.info("Executing stock script");
  log.info("Tickers = "+tickers);
  log.info("Twitter Accounts = "+twitterAccounts);
  var mongoUrl = 'mongodb://' +process.env.MONGODB_ADMIN_USER+ ':' +process.env.MONGODB_ENV_MONGODB_PASS+ '@' +process.env.MONGODB_PORT_27017_TCP_ADDR+ ':' +process.env.MONGODB_PORT_27017_TCP_PORT+ '/' +process.env.MONGODB_DATABASE;
  var mongoOptions = { server: { socketOptions: { keepAlive: 1, connectTimeoutMS: 300 } }, 
                replset: { socketOptions: { keepAlive: 1, connectTimeoutMS : 300 } } };
  var Follower = mongoose.model('Follower', {following_account: String, name: String, screen_name: String, profile_image_url_https: String});
  var resultMail = "";
  var couldGetNewFollowers = true;
  async.parallel({
    tickers: function (callback) {
      var tickersJson = {};
      async.each(tickers, function(ticker, callback) {
        getTickerPrice(ticker, function(err, currentPrice) {
          log.trace("Got price for company "+currentPrice.company+" equal to "+currentPrice.price);
          // TODO: save data in mongo
        
          // Company price
          tickersJson[currentPrice.ticker.replace(/"/g, '')] = currentPrice;
          //tickersJson[currentPrice.ticker.replace(/"/g, '')].price = currentPrice.price;
          //tickersJson[currentPrice.ticker.replace(/"/g, '')].name = currentPrice.price;
          callback(null);
        });
      }, function(err) {
        if (err) {
          log.error(err);
          return;    
        }
        log.trace("Finished processing tickers. tickersJson = "+JSON.stringify(tickersJson));
        callback(null, tickersJson);
      });
    },
    
    twitterAccounts: function(callback) {
      async.waterfall([
        function(callback) {
          var twitterAccountsJson = {};
          var conn = mongoose.connection;
          mongoose.connect(mongoUrl, mongoOptions);
          conn.on('error', function (err) {
            if (err) {
              couldGetNewFollowers = false;
              log.error("ERROR connecting to MongoDB...");
              log.error(err);
              return callback(err, twitterAccountsJson);
            }
          });
          async.each(twitterAccounts, function(account, callback) {
            // Get total followers
            getTwitterAccountFollowersCount(account, function (err, totalFollowers) {
              twitterAccountsJson[account] = {};
              if (err) {
                log.error("Error getting followers count for account "+account+" giving it up...: ");
                log.error(err);
                twitterAccountsJson[account].totalFollowers = "Could not retrieve data";
                return callback(null);
              }
              log.trace("Twitter account "+account+" has a total of "+totalFollowers+" followers");
              twitterAccountsJson[account].totalFollowers = totalFollowers;
              callback(null);
            });
          }, function(err) {
            if (err) {
              log.error(err);
              return;    
            }
            log.trace("Finished processing total followers count. twitterAccountsJson = "+JSON.stringify(twitterAccountsJson));
            callback(null, twitterAccountsJson);
          });
        },
      
        function(twitterAccountsJson, callback) {
          async.each(twitterAccounts, function(account, callback) {
            // Get new followers
            twitterAccountsJson[account].newFollowers = []; // This is the html body
            getTwitterAccountNewFollowers(account, function (err, currentFollowers) {
              if (err) {
                log.error("Error getting NEW followers for account "+account+" giving it up...: ");
                log.error(err);
                twitterAccountsJson[account].newFollowers = "Could not retrieve data";
                return callback(null);
              }
              log.trace("Succesfully got NEW twitter followers for user "+account);
           
              async.each(currentFollowers, function(follower, callback) {
                async.each(follower.users, function(user, callback) {
                  log.debug("Looking for user " +account+ ":" +user.screen_name+ " on MongoDB...");
                  Follower.findOne({following_account: account, screen_name: user.screen_name}, function (err, theFollower) {
                    if (err) {
                        log.error("ERROR looking for user " +account+ ":" +user.screen_name+ " on MongoDB...");
                        log.error(err);
                        return callback(err);
                    } else if (! theFollower) {
                      log.trace("User " +account+ ":" +user.screen_name+ " not found on MongoDB, adding it...");
                      twitterAccountsJson[account].newFollowers.push(user);
                      var newFollower = new Follower({following_account: account, name: user.name, screen_name: user.screen_name, profile_image_url_https: user.profile_image_url_https});
                      newFollower.save(function (err, userObj) {
                        if (err) {
                          log.error(err);
                          return callback(err);
                        } else {
                          log.debug('saved successfully:', userObj);
                          callback(null);
                        }
                      });
                    } else if (theFollower) {
                      log.trace("User " +account+ ":" +user.screen_name+ " found in MongoDB, continuing...");
                      callback(null);
                    }
                  });
                //  callback(null);
                },
                function (err) {
                  if (err) {
                    log.error(err);
                    return callback(err);
                  }
                  callback(null);
                });
              },
              function (err) {           
                if (err) {
                  log.error(err);
                  return callback(err);
                }
                callback(null);
              });
            });  
          },
          function(err) {
            if (err) {
              log.error(err);
              return callback(err, twitterAccountsJson);    
            }
            log.trace("Finished processing new twitter accounts. twitterAccountsJson = "+JSON.stringify(twitterAccountsJson));
            callback(null, twitterAccountsJson);
          });
        }],
        
        function (err, twitterAccountsJson) {
          mongoose.disconnect();
          log.trace("Finishing processing all twitter accounts (total & new followers). twitterAccountsJson = "+JSON.stringify(twitterAccountsJson));
          callback(null, twitterAccountsJson);
        });
    }
  },
  
  function (err, resultJson) {
    log.debug("Finished processing tickers and twitter accounts, sending this json via email: "+JSON.stringify(resultJson));
    sendMail(resultJson, function(err) {
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
        company: parsed[0].replace(/"/g, ''),
        ticker: parsed[1].replace(/"/g, ''),
        price: parsed[2].replace(/\n/g, '')
      });
    });
  }); 
}

function getTickerTweets(ticker, callback) {
  var client = new Twitter({
    consumer_key: twitterConsumerKey,
    consumer_secret: twitterConsumerSecret,
    access_token_key: twitterAccessTokenKey,
    access_token_secret: twitterAccessTokenSecret
  });
  return client.get('/search/tweets', {q: ticker}, function (err, tweets, response) {
    callback(err, tweets);
  }); 
}

function getTwitterAccountFollowersCount(account, callback) {
  var client = new Twitter({
    consumer_key: twitterConsumerKey,
    consumer_secret: twitterConsumerSecret,
    access_token_key: twitterAccessTokenKey,
    access_token_secret: twitterAccessTokenSecret
  });
  client.get('/users/show', {screen_name: account}, function (err, data, response) {
    callback(err, data.followers_count);
  }); 
}

function getTwitterAccountNewFollowers(account, callback) {
  var client = new Twitter({
    consumer_key: twitterConsumerKey,
    consumer_secret: twitterConsumerSecret,
    access_token_key: twitterAccessTokenKey,
    access_token_secret: twitterAccessTokenSecret
  });
  var totalFollowers = [];
  client.get('/followers/list', {screen_name: account, count: '200'}, function getData(err, followers, response) {
    totalFollowers = totalFollowers.concat(followers);
    log.trace("Cursor = "+followers.next_cursor);
    if(followers.next_cursor > 0) {
      client.get('/followers/list', {screen_name: account, cursor: followers.next_cursor, count: '200'}, getData);
    } else {
      callback(err, totalFollowers);
    }
  }); 
}

function sendMail(resultJson, callback) {
  var resultMail = "";
  resultMail = resultMail+"<h2>Tickers information:</h2>";
  log.trace("Iterating over tickersJson. Size = "+_.size(resultJson.tickers));
  for (ticker in resultJson.tickers) {
    // Company Price HTML
    resultMail = resultMail+"<p>";
      resultMail = resultMail+"<h3>"+ticker+" - "+resultJson.tickers[ticker].company+"</h3>";
      resultMail = resultMail+"<ul>";
        resultMail = resultMail+"<li><strong>Price: "+resultJson.tickers[ticker].price+ "</strong></li>";
      resultMail = resultMail+"</ul>";
    resultMail = resultMail+"</p>";
  }
  log.trace("resultMail = "+resultMail);
  
  resultMail = resultMail+"<h2>Twitter accounts information:</h2>";
  log.trace("Iterating over twitterAccountsJson. Size = "+_.size(resultJson.twitterAccounts));
  for (account in resultJson.twitterAccounts) {
    // Account Total followers HTML
    resultMail = resultMail+"<p>";
      resultMail = resultMail+"<h3>@"+account+"</h3>";
      resultMail = resultMail+"<ul>";
        resultMail = resultMail+"<li><strong>Total Followers: "+resultJson.twitterAccounts[account].totalFollowers+"</strong></li>";
        if (! couldGetNewFollowers || resultJson.twitterAccounts[account].newFollowers == "Could not retrieve data") {
          resultMail = resultMail+"<li><strong>New Followers: Could not retrieve data</strong></li><p>";
        } else {
          resultMail = resultMail+"<li><strong>New Followers: "+resultJson.twitterAccounts[account].newFollowers.length+"</strong></li><p>";
          for (follower in resultJson.twitterAccounts[account].newFollowers) {
            resultMail = resultMail+'<div>&emsp;<img style="vertical-align:middle" src="'+resultJson.twitterAccounts[account].newFollowers[follower].profile_image_url_https+'"><span style=""> <a href="https://twitter.com/'+resultJson.twitterAccounts[account].newFollowers[follower].screen_name+'">@'+resultJson.twitterAccounts[account].newFollowers[follower].screen_name+'</a> - '+resultJson.twitterAccounts[account].newFollowers[follower].name+'</span></div><br>';
          }
        }
      resultMail = resultMail+"</p></ul>";
    resultMail = resultMail+"</p>";
  }
  log.trace("resultMail = "+resultMail);

  
  log.debug("Sending mail with this HTML body: "+resultMail);
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
      return callback(err);
    }
    log.info("Mail sent: " + response.message);
  });
}
