# email-scripts
## Update container
```bash
docker stop stock
docker rm stock
docker pull wroloson/email-scripts:latest
docker run -ti -d --restart always --name stock -h stock -e TICKERS=IBKR -e MAIL_PROVIDER=hotmail -e MAIL_USER=XXXXXX -e MAIL_PASSWORD=YYYYYY -e MAIL_RECIPIENTS="first@recipient.com,second@recipient.com" -e CRON_EXPRESSION="0 0 * * *" -e TWITTER_CONSUMER_KEY=XXXXXX -e TWITTER_CONSUMER_SECRET=XXXXXX -e TWITTER_ACCESS_TOKEN_KEY=XXXXXX -e TWITTER_ACCESS_TOKEN_SECRET=XXXXXX -e TWITTER_ACCOUNTS=account1,account2,account3 --link mongodb:mongodb wroloson/email-scripts
```

## Add more tickers
Just execute these commands, but add the new tickers on "-e TICKERS=XXX,YYY,ZZZ" parameter. You can specify as much tickers as you want, comma separated:

```bash
docker stop stock
docker rm stock
docker run -ti -d --restart always --name stock -h stock -e TICKERS=IBKR -e MAIL_PROVIDER=hotmail -e MAIL_USER=XXXXXX -e MAIL_PASSWORD=YYYYYY -e MAIL_RECIPIENTS="first@recipient.com,second@recipient.com" -e CRON_EXPRESSION="0 0 * * *" --link mongodb:mongodb wroloson/email-scripts
````

## Show logs
```
docker exec -ti stock tail -f /var/log/email.log
```
