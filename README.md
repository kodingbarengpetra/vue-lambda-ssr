# Vue Lambda SSR

## Directory Structure

This project contains 2 main directory structure

```
//
├─ lambda/ssr/    Contains the SSR code. This will be deployed as lambda but can be run locally.
├─ web/           Contains the web.
```

## Requirements

- Docker
- Docker Compose

## Running Locally

```
./bin/build.sh
docker-compose up
```

To test the original Vue app.

```
curl localhost:8080
```

To test the rendered 

```
curl localhost:3000
```

To test using 

```
curl --user-agent "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z‡ Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" $url
```

