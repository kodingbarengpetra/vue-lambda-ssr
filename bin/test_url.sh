#!/usr/bin/env bash
while true;
do
    curl --user-agent "Googlebot/2.1 (+http://www.google.com/bot.html)" $1;
    sleep 1;
    curl $1;
    sleep 1;
done
