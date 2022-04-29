#!/usr/bin/env bash
URL=$1
while true;
do
    echo "Bot Request:";
    curl --user-agent "Googlebot/2.1 (+http://www.google.com/bot.html)" $URL;
    echo -e "\n\n\n\n";
    sleep 1;
    echo "Normal Request:";
    curl $URL;
    echo -e "\n\n\n\n";
    sleep 1;
done
