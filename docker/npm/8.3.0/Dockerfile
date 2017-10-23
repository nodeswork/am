ARG base
FROM ${base}:8.3.0

# Create app directory
WORKDIR /usr/src/app

COPY index.js .

ARG package
ARG version
ARG appletToken

ENV NW_NA_TYPE npm
ENV NW_NA_VERSION 8.3.0
ENV NW_PACKAGE_NAME $package
ENV NW_PACKAGE_VERSION $version
ENV NW_APPLET_TOKEN $appletToken

RUN npm install ${package}@${version}

ENV NODE_ENV production

EXPOSE 28900

CMD node index.js
