FROM ubuntu:14.04

MAINTAINER Manel Martinez <manel@nixelsolutions.com>
ENV DEBIAN_FRONTEND noninteractive

# Install dependencies
RUN apt-get update && \
    apt-get install -y curl build-essential supervisor

# Install nodejs
RUN curl -sL https://deb.nodesource.com/setup | bash -
RUN apt-get install -y nodejs

ENV TICKERS **ChangeMe**
ENV MAIL_PROVIDER **ChangeMe**
ENV MAIL_USER **ChangeMe**
ENV MAIL_PASSWORD **ChangeMe**
ENV MAIL_RECIPIENTS **ChangeMe**
ENV CRON_EXPRESSION 0 0 * * 1-5

ENV MONGODB_ADMIN_USER admin
ENV MONGODB_DATABASE admin

ADD ./src /src
WORKDIR /src
RUN npm install

RUN mkdir -p /var/log/supervisor

RUN mkdir -p /usr/local/bin
ADD ./bin /usr/local/bin
RUN chmod +x /usr/local/bin/*.sh
ADD ./etc/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

CMD ["/usr/local/bin/run.sh"]
