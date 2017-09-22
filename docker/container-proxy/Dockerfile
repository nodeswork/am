FROM node:8.3.0

# Create app directory
WORKDIR /usr/src/app

COPY index.js .

ARG version

ENV NODE_ENV production

RUN npm install @nodeswork/container-proxy@${version}

EXPOSE 8080

CMD node index.js
