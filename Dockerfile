FROM node:24-alpine

# Install database clients needed for backups
RUN apk add --no-cache \
    mysql-client \
    mariadb-connector-c \
    postgresql-client \
    rsync \
    openssh-client \
    tzdata

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

CMD ["npm", "run", "start"]