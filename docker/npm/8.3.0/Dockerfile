FROM node:8.3.0

# Create app directory
WORKDIR /usr/src/app

COPY index.js .

ARG package
ARG version

ENV PACKAGE $package
ENV TARGET  $package@$version

RUN npm install ${package}@${version}

ENV NODE_ENV production

EXPOSE 28900

CMD node index.js
