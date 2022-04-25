#!/usr/bin/env bash
while true;
do
    echo "Bot Request:";
    curl --user-agent "Googlebot/2.1 (+http://www.google.com/bot.html)" $1;
    echo -e "\n\n\n\n";
    sleep 1;
    echo "Normal Request:";
    curl $1;
    echo -e "\n\n\n\n";
    sleep 1;
done
