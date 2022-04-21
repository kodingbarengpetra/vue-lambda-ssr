FROM node:lts-alpine

# make the 'app' folder the current working directory
WORKDIR /app

# Install dependencies for chrome
RUN apk add chromium

# copy both 'package.json' and 'package-lock.json' (if available)
COPY package*.json ./

# install project dependencies
RUN npm install

# copy project files and folders to the current working directory (i.e. 'app' folder)
COPY . .

# build the web
RUN npm run build

EXPOSE 8080
CMD [ "npm", "run", "serve" ]
