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

