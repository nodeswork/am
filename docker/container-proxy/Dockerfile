FROM node:8.3.0

# Create app directory
WORKDIR /usr/src/app

COPY index.js .

ARG version

ENV NODE_ENV production

ENV PORT 28320
ENV NW_NA_TYPE npm
ENV NW_NA_VERSION 8.3.0
ENV NW_PACKAGE_NAME @nodeswork/container-proxy
ENV NW_PACKAGE_VERSION $version
ENV NW_APPLET_TOKEN $appletToken

RUN npm install @nodeswork/container-proxy@${version}

EXPOSE 28320

CMD node index.js
