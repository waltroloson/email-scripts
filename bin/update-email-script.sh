#/bin/bash

DOCKER_COMPOSE_FILE=/root/email-script/docker-compose.yml
DOCKER_COMPOSE_BIN=/usr/local/bin/docker-compose

[ ! -e ${DOCKER_COMPOSE_FILE} ] && echo "ERROR: ${DOCKER_COMPOSE_FILE} does not exist - Exiting..." && exit 1
[ ! -r ${DOCKER_COMPOSE_FILE} ] && echo "ERROR: could not read ${DOCKER_COMPOSE_FILE} - Exiting..." && exit 1

[ ! -e ${DOCKER_COMPOSE_BIN} ] && echo "ERROR: ${DOCKER_COMPOSE_BIN} does not exist, is docker-compose installed? - Exiting..." && exit 1
[ ! -x ${DOCKER_COMPOSE_BIN} ] && echo "ERROR: could not execute ${DOCKER_COMPOSE_BIN}, is docker-compose installed? - Exiting..." && exit 1

# Transform long options to short ones
for arg in "$@"; do
  shift
  case "$arg" in
    "--help") set -- "$@" "-h" ;;
    "--add") set -- "$@" "-a" ;;
    "--remove") set -- "$@" "-d" ;;
    "--recipients") set -- "$@" "-r" ;;
    "--tickers")   set -- "$@" "-s" ;;
    "--twitters")   set -- "$@" "-t" ;;
    *)        set -- "$@" "$arg"
  esac
done

function usage () {
  echo ""
  echo "Add recipients: $0 --add --recipients recipient1@address.com"
  echo "Add tickers: $0 --add --tickers ticker1"
  echo "Add Twitter accounts: $0 --add --twitters account1"
  echo ""
  echo "Remove recipients: $0 --remove --recipients recipient1@address.com"
  echo "Remove tickers: $0 --remove --tickers ticker1"
  echo "Remove Twitter accounts: $0 --remove --twitters account1"
  echo ""
  echo "NOTE: you can specify more than one value separated by a comma, for example: ticker1,ticker2"
  echo ""
}

while getopts "hadr:s:t:" PARAMS; do
  case $PARAMS in
  h)
    usage
    exit 0
    ;;
  a)
    OPERATION="add"
    ;;
  d)
    OPERATION="remove"
    ;;
  r)
    VARIABLE=MAIL_RECIPIENTS
    NEW_VALUES=`echo ${OPTARG} | sed "s/,/ /g"`
    ;;
  s)
    VARIABLE=TICKERS
    NEW_VALUES=`echo ${OPTARG} | sed "s/,/ /g"`
    ;;
  t)
    VARIABLE=TWITTER_ACCOUNTS
    NEW_VALUES=`echo ${OPTARG} | sed "s/,/ /g" | sed "s/\@//g"`
    ;;
  esac
done

[ -z "${OPERATION}" ] && echo "ERROR: you should specify --add or --remove option - Exiting..." && exit 1
[ -z "${VARIABLE}" ] && usage && exit 1
[ -z "${NEW_VALUES}" ] && usage && exit 1

set -e

# Save a backup
BACKUP_DATE=`date +%Y%m%d-%H%M%S`
cp -p ${DOCKER_COMPOSE_FILE} ${DOCKER_COMPOSE_FILE}.${BACKUP_DATE}
echo "Saved backup file ${DOCKER_COMPOSE_FILE}.${BACKUP_DATE}"

VALUES=`grep "${VARIABLE}:" ${DOCKER_COMPOSE_FILE} | awk -F: '{print $2}' | sed "s/\"//g" | sed "s/ //g"`

case ${OPERATION} in
  add)
    for newValue in ${NEW_VALUES}; do
      VALUES+=",${newValue}"
    done
    ;;
  remove)
    for newValue in ${NEW_VALUES}; do
      VALUES=(${VALUES[@]/,"$newValue"/})
    done
    ;;
  *)
    echo "ERROR: Unknown operation ${OPERATION} - Exiting..."
    exit 1
    ;;
esac

VALUES=`echo ${VALUES} | sed "s/\@/\\\\\@/g"`
perl -p -i -e "s/${VARIABLE}: ?.*/${VARIABLE}: \"${VALUES}\"/g" ${DOCKER_COMPOSE_FILE}

docker-compose -f ${DOCKER_COMPOSE_FILE} stop stock
sleep 1
docker-compose -f ${DOCKER_COMPOSE_FILE} rm -f stock
sleep 1
docker-compose -f ${DOCKER_COMPOSE_FILE} up -d stock

echo "OK: Completed..."
